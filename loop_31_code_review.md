# CODE REVIEW
_(Loop 31: Online Payments Integration - Paystack)_

## SECURITY REVIEW

**Paystack Security**:
- `x-paystack-signature` HMAC-SHA512 verification over the raw request body: **PASS**. The `verifyWebhookSignature` function is correctly implemented and correctly executed before JSON parsing.
- Webhook replay/idempotency handling: **PASS**. The Prisma schema enforces `@unique` on `gatewayId`, and the webhook logic uses an atomic `$transaction` to safely ignore duplicate events when it catches an existing record.
- Server-only secret key usage: **PASS**. `PAYSTACK_SECRET_KEY` is loaded safely on the server backend.

**Payment Integrity**:
- Canonical Decimal GHS → integer pesewas conversion: **PASS**. The backend uses `Prisma.Decimal` and `mul(100).toDecimalPlaces(0)` to strictly avoid floating-point errors.
- Cross-Sale spoofing prevention: **PASS**. `saleId` and `portalToken` are securely bound to Paystack metadata upon initialization and cross-verified in the webhook.
- Amount verification against the payment intent: **HIGH FINDING**. The webhook payload amount is converted to GHS, but it is **not explicitly checked against `metadata.amountPesewas`**. While cross-sale spoofing is mitigated by `portalToken`, an attacker manipulating the amount mid-flight (if Paystack was compromised or intercepted) could theoretically force STONEY to record a smaller payment than expected. The architecture document specifically mandated: "Validates the amount in the webhook payload directly against the expected metadata."
- Pending/failed/success states: **PASS**. Handled via `gatewayStatus`.
- Transaction Verification (Success Page): **HIGH FINDING**. The `loop_31_architecture.md` mandates that `/portal/[portalToken]/success` verifies the reference directly against the Paystack `/transaction/verify/` API. The current `page.tsx` merely displays a static "Payment Successful!" screen without parsing `searchParams.reference` or calling `verifyTransaction()`.

**Authorization**:
- Portal JWT validation: **PASS**. `getPortalDocument` securely enforces the customer token boundaries.
- Branch isolation: **PASS**. Invariants from Loop 30 are maintained.

## DATABASE REVIEW
- Payment schema: **PASS**. Correctly updated to handle `gatewayId`, `gatewayStatus`, etc.
- Constraints/Indexes: **PASS**. `gatewayId` is `@unique`.
- Migration history: **PASS**. Additive non-destructive changes.
- Artifacts: **PASS**. No rogue scratch files.

## PERFORMANCE REVIEW
- Webhook deferral of JSON parsing: **PASS**.
- Atomic transactions: **PASS**. Safe concurrency behavior.

## TEST REVIEW
- **MEDIUM FINDING**: The added tests in `actions.test.ts` and `route.test.ts` are overly simplistic mock-only executions. They do not assert the security invariants (such as rejecting cross-sale spoofing or correctly identifying invalid webhook signatures).

---

# FINDINGS

1. **[HIGH] Webhook Amount Validation Missing**
   - **Location**: `src/app/api/webhooks/paystack/route.ts`
   - **Details**: The webhook does not validate `data.amount` against `metadata.amountPesewas`.
   
2. **[HIGH] Transaction Verification Missing on Success Page**
   - **Location**: `src/app/portal/[portalToken]/success/page.tsx`
   - **Details**: The client-provided Paystack `reference` (via URL search params) is not being verified against the Paystack `/transaction/verify/` API.

3. **[MEDIUM] Shallow Test Coverage**
   - **Location**: `actions.test.ts` & `route.test.ts`
   - **Details**: Security invariants are untested.

4. **[LOW] Type Safety in Pay Page**
   - **Location**: `src/app/portal/[portalToken]/pay/page.tsx`
   - **Details**: Uses `const doc = data.document as any;` which bypasses TypeScript validations for financial math rendering.

---

# REQUIRED FIXES

1. Update `src/app/api/webhooks/paystack/route.ts` to strictly throw an error if `data.amount !== metadata.amountPesewas`.
2. Update `src/app/portal/[portalToken]/success/page.tsx` to read `searchParams.reference` (or `trxref`), execute the server-side `verifyTransaction(reference)`, and display success/failure dynamically. Remove the hardcoded static success message.

# OPTIONAL IMPROVEMENTS
- Improve test coverage to assert cross-sale spoofing blocks and invalid signature behaviors.
- Remove `as any` in the portal pay page.

---

# FINAL VERDICT

CODE REVIEW BLOCKED
