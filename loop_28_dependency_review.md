# Loop 28 Dependency Review: Document Generation & Delivery

## Current State of STONEY Platform

Through Loop 27, the STONEY platform has successfully implemented its core domain modules:

- Foundation & Authentication
- Inventory Management (Products, Categories, Brands, Stock, Audits)
- CRM & Repairs (Customers, Device intake, Repair lifecycle)
- Sales & Quotations (POS checkout, quoting, tax/discount math)
- Branch Operations (Shift management, Cash drawers)

## The Single Highest-Value Remaining Capability

To move STONEY toward **production readiness** for a physical retail and repair environment, the single highest-value missing capability is **Document Generation & Delivery (Receipts, Invoices, and Repair Tickets)**.

### Why this capability?

1. **Legal & Operational Blockers**: In almost every jurisdiction, it is a legal requirement to provide a customer with a receipt of sale. Furthermore, repair shops cannot function without printable intake tickets (often attached to the physical device) and professional quotations sent to customers for approval.
2. **Customer Experience**: Customers expect digital (Email) or physical (Printed) copies of their transactions. The current system records transactions in the database but provides no tangible output for the customer.
3. **Hardware Independence**: By implementing web-based PDF generation and standard print stylesheets (`@media print`), STONEY can remain hardware-agnostic (working with standard A4 printers and 80mm thermal receipt printers) without needing complex native hardware integrations immediately.

### Alternative Gaps Considered

- _Payment Gateway Integration (Stripe)_: High value, but physical stores often use standalone card terminals (EFTPOS) which only require the POS to record the payment method (which is currently supported).
- _System-wide Audit Logging_: Important for compliance, but secondary to the ability to actually perform and complete a customer-facing transaction with a receipt.
- _AI Automation_: A Phase 5 stretch goal, but not a strict blocker for production readiness compared to receipts.

## Dependencies for Document Generation

- **Sales Data**: Requires the `Sale`, `SaleItem`, and `Payment` models.
- **Repair Data**: Requires the `Repair`, `Device`, and `Customer` models.
- **Quotation Data**: Requires the `Quotation` and `QuotationItem` models.
- **Settings**: Requires `StoreSettings` (for `currencyCode`, `currencySymbol`, `taxRegistration`, `receiptFooter`) to properly format the documents.
- **Media/Storage**: (Optional) If we choose to persist generated PDFs, we would depend on the `MediaAsset` infrastructure. However, on-the-fly generation is preferred for data integrity.

## Conclusion

Implementing PDF generation, Print Stylesheets (thermal & A4), and Email delivery for these documents is the final critical path item to allow a STONEY branch to open its doors to the public.
