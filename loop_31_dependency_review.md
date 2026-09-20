# Loop 31 Dependency Review: Online Payments Integration (Stripe)

## 1. Proposed Loop 31 capability
**Online Payments Integration (Stripe)** for the Public Customer Portal.

## 2. Problem/business need
With Loop 30 delivering the Customer Portal and Quotation Approvals, customers can now interact with the STONEY Platform digitally. However, they currently cannot settle their invoices, pay for completed repairs, or pay deposits online. Integrating a payment gateway accelerates cash flow, allows for contact-less online settlement of repair tickets before in-store pickup, and provides the final piece of the digital customer journey required for full B2B/B2C SaaS competitiveness.

## 3. Existing dependencies
- **Loop 30 (Customer Portal)**: The payment capability will be embedded directly into the authenticated `/portal/[portalToken]` routes.
- **Loop 28 (Documents) & Loop 29 (Email)**: Invoices sent via email will now direct users to the portal with an actionable "Pay Now" flow.
- **Loop 25 (Shift Management & Cash Drawers)**: Online payments must bypass physical cash drawers. They need to be correctly attributed to the Branch's sales reporting but explicitly separated as "Gateway/Online" payments to ensure physical register balances remain accurate.
- **Data Model**: The `Payment` model currently exists but assumes manual entry by a staff member (CASH, CARD, TRANSFER, OTHER).

## 4. Current repository capabilities relevant to it
- The `Sale` and `Payment` models are fully established to track sub-totals, taxes, and total amounts.
- The security verification and JWT cookie structure implemented in the Portal (Loop 30) prevents IDOR and ensures the customer is securely authenticated before they can view or pay an invoice.
- The Prisma schema includes a `PaymentMethod` enum which can easily be extended.

## 5. Missing capabilities
- Stripe Node.js SDK integration and webhook handlers.
- Database extensions to store gateway transaction references (e.g., Stripe PaymentIntent IDs), statuses, and webhook idempotency keys to prevent double-processing.
- A frontend UI component for the Stripe Payment Element (or secure redirection to Stripe Checkout).
- Secure, signature-verified webhook endpoints to asynchronously record a `Payment` and transition `Sale` status to `COMPLETED` when Stripe confirms the funds.
- Logic to prevent partial payments if the business rule requires full settlement, or tracking partial deposits if allowed.

## 6. Risks and constraints
- **Concurrency & Double Payments**: A customer might pay online on their phone at the exact same moment they walk into the store and hand cash to the clerk. Strict optimistic concurrency and idempotent webhook handling are critical to prevent overpayment or duplicate `Payment` records.
- **PCI Compliance**: We must use Stripe Elements or Stripe Checkout. Under no circumstances should raw credit card data touch or pass through STONEY's backend servers.
- **Webhook Reliability**: If a Stripe webhook is delayed or dropped, the system might not immediately record the payment, leading to a poor customer experience (e.g., they paid, but the portal still says unpaid). A fallback polling or client-side confirmation sync mechanism is needed.
- **Shift Reconciliation**: Online payments do not enter a physical cash drawer. Financial reporting must clearly differentiate gateway funds from physical funds to avoid end-of-day register discrepancies.

## 7. Required architectural considerations
- **Schema Updates**: Update the `PaymentMethod` enum to include `ONLINE` or `STRIPE`. Add fields such as `gatewayId` (unique), `gatewayStatus`, and `receiptUrl` to the `Payment` model.
- **Stripe Webhooks**: A public, signature-verified endpoint (e.g., `/api/webhooks/stripe`) must be established to listen for `payment_intent.succeeded` events.
- **Idempotency**: Use database constraints on `gatewayId` to ensure a webhook processed twice doesn't create duplicate records.
- **Concurrency Control**: When a PaymentIntent is created, the system must use a `version` field on the `Sale` (similar to Quotations in Loop 30) or lock the sale to prevent overlapping manual payments in the POS.

## 8. Explicit scope boundaries
- **In Scope**: 
  - Integrating Stripe for paying `Sale` invoices online via the Customer Portal. 
  - Handling Stripe Webhooks for payment success. 
  - Extending the `Payment` model for gateway metadata.
- **Out of Scope**: 
  - Physical EFTPOS terminal integration (Stripe Terminal). 
  - Subscriptions or recurring billing. 
  - Multi-currency support (assume single base currency for now). 
  - Processing refunds via the STONEY UI (refunds will be handled manually via the Stripe Dashboard for this loop to constrain scope).

## 9. Recommended next stage
Proceed to the **Architecture** phase to detail the database schema extensions for payments, the webhook security model, the Stripe Checkout integration flow, and the concurrency controls for the `Sale` entity.
