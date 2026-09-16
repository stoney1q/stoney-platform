# Loop 30 Dependency Review: Public Customer Portal

## 1. Current Platform State

The STONEY Platform has achieved a highly functional internal operating state through Loop 29:

- **Core Operations**: Inventory, Procurement, Branch Management.
- **Retail POS**: Sales checkout, Cash Drawers & Shift Management (Loop 25).
- **Service Operations**: Device Intake, Repairs, and Quotations.
- **Documents & Comms**: PDF Generation for Receipts/Invoices (Loop 28), and Asynchronous Email Delivery (Loop 29).

Currently, STONEY is functionally complete for **internal staff** working behind a counter.

## 2. The Single Highest-Value Remaining Capability

To achieve true production readiness in a modern retail/repair market, STONEY must bridge the gap between internal operations and the external customer experience.

The single highest-value remaining capability is the **Public Customer Portal (Repair Tracking & Quotation Approval)**.

### Why this capability?

1. **Operational Efficiency**: Repair shops lose significant labor hours answering phone calls from customers asking "Is my repair ready?". A public tracking portal eliminates this friction.
2. **Quotation Conversion**: Currently, when a Quotation is generated and emailed (Loop 29), there is no mechanism for the customer to independently accept it. Staff must call the customer, get verbal approval, and manually update the system. A secure portal where customers can view the quotation and click "Approve" (or "Reject") drastically reduces friction and increases conversion rates.
3. **Competitive Parity**: Modern repair shop SaaS platforms (e.g., RepairDesk, RepairShopr) universally offer customer-facing tracking widgets.
4. **Prerequisite for Online Payments**: Establishing a secure public route for a customer to view an invoice is a strict prerequisite for eventually integrating a payment gateway (like Stripe Checkout) for online invoice settlement.

## 3. Alternative Capabilities Considered

1. **Payment Gateway Integration (Stripe Terminal)**: High value, but physical stores can launch with standalone EFTPOS terminals (which they already own) by recording the payment method manually (which STONEY already supports).
2. **Supplier Returns (RTV)**: Important for inventory management, but lower priority than customer-facing revenue-driving features.
3. **Hardware Integrations (ESC/POS Printing, Cash Drawer Kicking)**: Explicitly deferred in earlier architectures; browser-based printing is deemed sufficient for MVP production readiness.
4. **SMS Delivery (Twilio)**: Email delivery was achieved in Loop 29. While SMS is heavily used, the Customer Portal provides a central hub that both Email and SMS will eventually point to.

## 4. Dependencies on Existing Modules

- **Data Models**: Depends heavily on `Quotation`, `Repair`, `Device`, `Customer`, and `Branch`.
- **Documents**: Leverages the `documentNumber` established in Loop 28 as a safe, unguessable identifier.
- **Email Delivery**: Relies on Loop 29's background email system. We will need to update the email templates to include secure links to the portal (e.g., "Click here to view and approve your quotation").
- **Security / Auth**: Because this is a public portal, it depends on a secure, tokenized or strict verification mechanism (e.g., `documentNumber` + `customerEmail` or OTP) to prevent unauthorized access (IDOR) to PII and pricing data.

## 5. Required Scope for Loop 30

- **Public Routing**: Introduce a new Next.js route group (e.g., `/portal/[documentNumber]`).
- **Security Verification**: Implement a verification challenge (e.g., verify email, phone, or PIN) before revealing full document details.
- **Repair Tracking UI**: A timeline view of the `RepairLog` transitions (Received -> Diagnosing -> Quoted -> Approved -> In Progress -> Completed).
- **Quotation Action UI**: A view of the quotation items with secure Server Actions to transition the state to `ACCEPTED` or `REJECTED`.
- **Email Template Updates**: Injecting portal links into the emails dispatched by Loop 29.

## 6. Conclusion

Building the Public Customer Portal completes the digital customer journey (Intake -> Email -> Online Approval -> Tracking -> Completion), representing the final major capability required for STONEY's core B2B offering to be competitive and production-ready.

---

**READY FOR ARCHITECTURE**
