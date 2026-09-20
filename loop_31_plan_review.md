# SECOND ADVERSARIAL PLAN REVIEW
_(Loop 31: Online Payments Integration - Stripe)_

## VERIFICATION OF PREVIOUS FINDINGS

1. **HIGH - Missing JWT Verification in Server Action**
   - *Status*: **RESOLVED**
   - *Review*: The amended plan explicitly requires `createStripeCheckoutSession` to strictly validate the HTTP-only JWT cookie. Furthermore, it binds the verification to the requested resource by ensuring the `portalToken` inside the JWT precisely matches the `Sale` being paid. This guarantees no unauthorized user can create a checkout session or view payment amounts.

2. **MEDIUM - Shift / Cash Drawer Discrepancies**
   - *Status*: **RESOLVED**
   - *Review*: The plan now explicitly targets the Loop 25/26 Shift queries and Dashboard files to ensure `PaymentMethod.STRIPE` is entirely excluded from the physical cash drawer `expectedBalance` calculations. It also mandates validation of this separation in the test plan, ensuring accurate end-of-day reconciliation.

---

## RE-ATTACK FINDINGS (All Domains)

- **Webhook Authentication & Signature Verification**: PASS. Bypasses Next.js body parsing (`req.text()`) to preserve the raw cryptographic payload.
- **Idempotency & Replay**: PASS. Relies on the database-level unique constraint (`gatewayId`) and gracefully swallows `P2002` duplicate errors to prevent infinite Stripe retries.
- **Duplicate Settlement & Orphaned Charges (Races)**: PASS. The transaction invariants guarantee that a successful Stripe charge is *never* dropped, even if it loses a race to a manual in-store payment. The system safely records the payment and flags the overpayment for manual review, preventing lost funds.
- **Remaining-Balance Calculation**: PASS. Safely subtracts the sum of successful existing payments from `Sale.total` to prevent massive overcharges when customers have previously paid a partial deposit.
- **Stripe Minimum-Charge Handling**: PASS. Limits checkout creation if the remaining balance is mathematically invalid or beneath the gateway threshold.
- **Database Migration Safety**: PASS. Adding default UUIDs to existing sales and making the `createdById` relation nullable prevents migration downtime or data corruption.
- **Authorization & Branch Isolation**: PASS. Customers are locked to their verified `portalToken`, which maps to a single `Sale` linked to its originating `Branch`.
- **Test Coverage**: PASS. Specifies local Stripe webhook forwarding, signature testing, and explicit concurrency simulation tests.

---

**FINAL VERDICT**

The implementation plan is extremely robust. The critical data invariants correctly address the asynchronous, distributed nature of webhooks and concurrent POS operations. Security and reconciliation gaps have been successfully closed.

**PLAN APPROVED**
