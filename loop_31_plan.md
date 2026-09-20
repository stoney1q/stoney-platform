# OBJECTIVE
Implement Loop 31: Online Payments Integration (Stripe) for the Customer Portal.

# APPROVED ARCHITECTURE
The Loop 31 Amended Architecture, adhering to invariants designed to prevent double-payment races and orphaned charges. Key principles:
1. **Unconditional Persistence**: Webhook always records successful Stripe charges.
2. **Overpayment Tracking**: Reconciles race conditions automatically if a staff member accepts cash concurrently.
3. **Amount Integrity**: Derives checkout amounts strictly from the database (remaining balance).
4. **Idempotency**: Swallows `P2002` duplicate webhook events gracefully.

# IMPLEMENTATION BOUNDARY
- **In-Scope**: Stripe Checkout integration, Webhook handling, Customer Portal Payment UI, Schema changes, Shift reporting adjustments for gateway payments.
- **Out-of-Scope**: Stripe Terminal (physical POS readers), Subscriptions, automated Refunds via STONEY UI, Partial custom deposits via portal (portal strictly pays the remaining balance).

# FILES TO CREATE
- `src/lib/stripe/client.ts` - Singleton for `stripe` SDK initialization.
- `src/lib/stripe/actions.ts` - Contains Server Action `createStripeCheckoutSession`.
- `src/app/api/webhooks/stripe/route.ts` - Next.js Route Handler for webhook processing.
- `src/app/portal/[portalToken]/pay/page.tsx` - Payment summary and checkout initiation UI.
- `src/app/portal/[portalToken]/success/page.tsx` - Stripe return URL with fallback sync.

# FILES TO MODIFY
- `prisma/schema.prisma` - `Sale` and `Payment` schema changes.
- `.env.example` - Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- `package.json` - Add `stripe`.
- `src/app/portal/[portalToken]/page.tsx` - Add "Pay Now" button if `remainingBalance > 0`.
- `src/lib/shifts/queries.ts` (or relevant Loop 25/26 shift files) - Exclude `PaymentMethod.STRIPE` from physical cash drawer metrics.
- `src/app/(authenticated)/shifts/page.tsx` (or dashboard widgets) - Visually distinguish gateway sales from physical cash sales.

# FILES NOT TO TOUCH
- `loop_24_checkpoint_report.md` (Uncommitted modified file identified in Git baseline).

# DATABASE CHANGES
- `Sale`: Add `portalToken String @unique @default(uuid())` and `version Int @default(1)`.
- `PaymentMethod`: Add `STRIPE`.
- `Payment`: Add `gatewayId String? @unique`, `gatewayStatus String?`, `receiptUrl String?`. Update `createdById String?` (make optional for automated webhooks).

# MIGRATION PLAN
Run `npx prisma migrate dev --name loop_31_stripe_payments`. Prisma will safely apply the default UUIDs to existing `Sale` records and make `Payment.createdById` nullable.

# SERVER/API CHANGES
1. `createStripeCheckoutSession` Action:
   - **Crucial Authorization**: MUST strictly validate the HTTP-only JWT cookie to ensure the customer has passed the Loop 30 Portal verification challenge. Ensure the `portalToken` in the JWT strictly matches the `Sale` being paid. Throw `UNAUTHORIZED` if invalid.
   - Calculate `remainingBalance = Sale.total - sum(successful payments)`.
   - Abort if `remainingBalance <= 0` or less than Stripe minimum (e.g., $0.50).
   - Create Stripe Checkout session securely linked to the `portalToken` and return the redirect URL.
2. `/api/webhooks/stripe` Endpoint:
   - **Crucial**: Use `await req.text()` to bypass Next.js JSON parsing, ensuring `stripe.webhooks.constructEvent` receives the raw byte stream.
   - Idempotency: Catch `P2002` on `gatewayId` and return `200 OK`.
   - Atomic Transition: Use `$transaction`. Insert `Payment`. If new `Total Paid >= Sale.total`, update `Sale.status = COMPLETED` and increment `version`. If the `Sale` was *already* `COMPLETED` when the webhook arrives, unconditionally record the `Payment` and log/flag an OVERPAYMENT.

# UI CHANGES
1. **Invoice View**: Portal dashboard displays "Remaining Balance" and conditionally renders the Pay button.
2. **Checkout Page**: Simple breakdown of what is being paid before redirecting to Stripe Hosted Checkout.
3. **Success Page**: Acknowledges payment.

# SECURITY REQUIREMENTS
- Portal endpoints and server actions must validate the JWT to prevent unauthorized access to checkout amounts or session creation.
- Webhook endpoint strictly signature-verified.
- `createdById` omitted for webhooks, but branch isolation maintained securely via the `Sale` relationship.
- Amount passed to Stripe must never rely on client payload data.

# TEST PLAN
- **Unit**: Verify `remainingBalance` calculation handles existing manual deposits correctly. Verify Stripe minimum charge validation.
- **Integration**: Local Stripe CLI webhook forwarding (`stripe listen`). Verify signature construction.
- **Concurrency**: Simulate a webhook arrival for a `Sale` that is already `COMPLETED`. Assert that the `Payment` is saved and an overpayment note/flag is raised.

# VALIDATION PLAN
- Staff creates Sale (total $100). Staff takes $50 cash deposit.
- Customer verifies identity in portal (JWT issued), sees $50 balance, pays via Stripe test card.
- Webhook correctly processes the payment, closes the Sale.
- Staff checks Shift totals, sees $50 CASH in the physical drawer expected balance, and $50 STRIPE explicitly separated in gateway/total sales.

# GIT CHECKPOINT PLAN
Stage `src/`, `prisma/`, and `package.json`. Commit as: `feat(payments): implement stripe checkout and webhooks (Loop 31)`.

# ROLLBACK/RECOVERY PLAN
- If webhook parsing fails in production, monitor Stripe logs, deploy hotfix, and manually replay webhooks from Stripe Dashboard.
- Schema down-migration if critical regressions occur.
