# DOMAIN DEPENDENCY REVIEW
_(Loop 31: Online Payments Integration - Paystack)_

# CURRENT STATE
STONEY currently supports manual payments (CASH, CARD, TRANSFER, OTHER) processed at the POS by staff. Loop 30 introduced a secure Customer Portal using a `portalToken` for Quotations and Repairs. However, customers cannot settle their invoices (Sale) online.

# DEPENDENCIES
- **Loop 30 (Customer Portal)**: Provides the authentication/verification foundation (JWT cookies, rate limiting).
- **Paystack Account**: A configured Paystack account for Ghana (supporting GHS, Mobile Money, Cards), with secret API keys.

# DOMAIN BOUNDARIES
- **Portal Payments**: Customers access `/portal/[portalToken]/pay`. The checkout interacts securely with an abstracted payment gateway provider (implemented initially via Paystack) and the STONEY backend.
- **Provider Abstraction**: A neutral `OnlinePaymentProvider` boundary that abstracts gateway-specific terminology (e.g. using `gatewayId` instead of `paystackReference` or `stripeId`). This ensures a future gateway can be added without altering STONEY's core payment domain.
- **Webhook Processing**: An isolated public API route `/api/webhooks/paystack` handles asynchronous events. Events must be cryptographically verified.
- **POS / Shift Domain**: Online payments bypass the physical cash drawer. Financial reports must explicitly distinguish `PAYSTACK` payments from physical tender.

# SECURITY MODEL
- **PCI-DSS Compliance**: Using Paystack Checkout ensures raw card data or Mobile Money PINs never touch STONEY servers.
- **Webhook Signatures**: The webhook endpoint (`/api/webhooks/paystack`) MUST consume the raw request body to compute and verify the HMAC-SHA512 hash against the `x-paystack-signature` header using the Paystack Secret Key.
- **Cross-Sale Transaction Spoofing**: A valid Paystack transaction must NEVER be accepted against another Sale merely because its reference is supplied by the client. Paystack transactions MUST embed the `portalToken` and `saleId` strictly inside the Paystack `metadata` object upon initialization. The webhook and verification layers MUST validate that the Paystack transaction's metadata matches the target `Sale` before settling the payment. If the metadata is missing or mismatched, the webhook MUST reject processing and log a security violation.
- **Currency Integrity (Pesewas Conversion)**: STONEY stores GHS amounts using `Prisma.Decimal`. Paystack strictly requires integer pesewas. To prevent floating-point arithmetic errors and ensure absolute precision, all conversions to pesewas MUST be performed strictly on the backend using Decimal operations (e.g., `amount.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()`). The amount sent to Paystack MUST be derived directly from STONEY's authoritative database calculation. The webhook MUST similarly parse Paystack's integer pesewas back to Decimal GHS for comparison and insertion.
- **Transaction Verification**: As an additional layer of security, the webhook should verify the transaction by making a server-to-server GET request to `/transaction/verify/:reference` before recording the payment, protecting against sophisticated spoofing.
- **Access Control**: A customer must pass the Loop 30 verification challenge to view the invoice and initiate payment.
- **Amount Integrity**: The payment initialization Server Action MUST derive the payment amount strictly by querying the `Sale` record from the database. Client payloads specifying amounts are ignored to prevent tampering.
- **Secret Isolation**: Paystack Secret Key must remain exclusively on the server, safeguarded during Next.js static builds.

# DATA MODEL
Modifications required in `prisma/schema.prisma`:
1. **`Sale` Model**:
   - Add `portalToken String @unique @default(uuid())` for secure public access.
   - Add `version Int @default(1)` to enforce optimistic concurrency during updates.
2. **`PaymentMethod` Enum**:
   - Add `PAYSTACK`.
3. **`Payment` Model**:
   - Change `createdById String` to `createdById String?`. Automated webhooks do not have a user context.
   - Add `gatewayId String? @unique` (to store Paystack's transaction `reference`). This enforces database-level idempotency and reference uniqueness.
   - Add `gatewayStatus String?` (e.g., 'success', 'failed', 'abandoned').
   - Add `receiptUrl String?`.

# API/SERVER ACTION DESIGN
1. **`initializeOnlinePayment` (Server Action)**:
   - Input: `portalToken`.
   - Action: Validates JWT, queries `Sale.total`. Calculates the authoritative remaining balance directly via Prisma queries. Converts the remaining Decimal GHS balance to an integer pesewa amount using the strict server-side canonical conversion, rejecting any fractional-pesewa anomalies. Creates a Paystack transaction containing `reference` (unique) and strictly binding `metadata: { saleId, portalToken, amountPesewas }`. Returns the authorization URL.
2. **`/api/webhooks/paystack` (API Route)**:
   - Uses raw body for HMAC-SHA512 verification.
   - Listens for `charge.success` events.
   - Validates that `metadata.portalToken` matches the `Sale` being credited.
   - Validates the `amount` in the webhook payload directly against the expected metadata.
   - Wraps the Payment creation (parsing pesewas back to GHS Decimal) and Sale status update in an atomic Prisma `$transaction`.
   - **Idempotency & Retries**: Catches Prisma `P2002` (Unique Constraint) on `Payment.gatewayId`. Gracefully returns `200 OK` to prevent retry storms from duplicate Paystack webhooks. Unhandled event types (like refunds processed from the dashboard) are logged and ignored with a `200 OK`.

# UI ARCHITECTURE
- **`/portal/[portalToken]/pay`**: Displays the invoice summary and initiates the Paystack Checkout. Designed for Ghana: explicitly supports Cards, Mobile Money (MTN, AirtelTigo, Telecel), and Pay with Transfer.
- **`/portal/[portalToken]/success`**: A return URL displaying a success confirmation. It queries the `Sale` state. The client provides the Paystack `reference`, but the backend verifies this reference directly against the Paystack `/transaction/verify/` API to prevent tampering.

# PERFORMANCE
- The webhook endpoint defers JSON parsing until the HMAC-SHA512 hash validates.
- Atomic `$transaction` eliminates multiple database round-trips.

# CONCURRENCY
**The Race Condition**: A customer pays via Paystack exactly when a staff member takes cash in-store.

**Transaction Invariant Strategy**: 
1. **No Orphaned Funds**: A successful `charge.success` webhook must NEVER be discarded, even if the `Sale` is already `COMPLETED` or `CANCELLED`. If Paystack charged the customer, STONEY must record it.
2. **Atomic Webhook Transaction**:
   - The webhook unconditionally creates the `Payment` record with `gatewayId`.
   - Calculates `Total Paid = sum(existing payments) + new Paystack payment`.
   - If `Total Paid == Sale.total`, transition `Sale.status` to `COMPLETED` (incrementing version).
   - If `Total Paid > Sale.total` (the race condition occurred), it flags the sale as an **OVERPAYMENT**. The business can then manually refund the physical cash or the Paystack charge from the Paystack Dashboard.
3. **POS Lockout Alert**: Optional frontend warning if an active checkout session is pending, but backend invariants guarantee data integrity regardless.

# OBSERVABILITY
- `RepairLog` or internal audit notes must be appended when an overpayment race condition occurs.
- Webhook logging to trace signature failures, metadata spoofing attempts, and duplicate events.

# TESTING STRATEGY
- Concurrency test: Processing a webhook and manual payment simultaneously must succeed and trigger the overpayment logic.
- HMAC signature test: Webhooks with invalid signatures must be rejected (400).
- Idempotency test: Replaying the exact same reference must gracefully yield a 200 without duplicate database entries.
- Spoofing test: Webhooks with a `metadata.portalToken` that does not match the target `Sale` must be explicitly rejected (400) to verify cross-sale protection.
- Conversion test: Decimal amounts must explicitly convert to and from pesewas without floating-point drift.

# DATABASE/MIGRATION IMPACT
- Adding fields to `Sale` and `Payment`.
- Updating `PaymentMethod` enum. 
- No destructive changes; safely backwards compatible.

# RISKS
- Mobile money asynchronous prompts may cause delayed webhooks.
- Duplicate webhooks from Paystack are common; the unique constraint is a hard requirement.

# DEFERRED SCOPE
- Automated Refunds via STONEY UI. Refunds will be initiated via the Paystack Dashboard, requiring manual STONEY reconciliation for now.
- Point of Sale Terminal integration (e.g., Paystack Terminal).

# ACCEPTANCE CRITERIA
1. Paystack is integrated via a provider-neutral abstraction layer for future extensibility.
2. Paystack Checkout is explicitly configured for Ghana (GHS, Mobile Money, Cards, Transfer).
3. Webhook cryptographically verifies HMAC-SHA512 `x-paystack-signature`.
4. Idempotency guarantees duplicate webhooks do not crash or create duplicate payments.
5. Concurrency race protection guarantees Paystack payments are always recorded to prevent orphaned funds.
6. `PAYSTACK` payments bypass physical shift cash drawer calculations entirely.
7. Database `gatewayId` provides a strictly unique 1:1 mapping with the Paystack transaction reference.
8. GHS to integer pesewas conversion is strictly enforced on the server using canonical Decimal logic without floating-point arithmetic.
9. Cross-sale transaction spoofing is explicitly blocked by embedding and validating `portalToken` strictly within the Paystack transaction metadata.

READY FOR IMPLEMENTATION: YES
