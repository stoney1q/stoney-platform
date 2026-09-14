# DOMAIN DEPENDENCY REVIEW & ARCHITECTURE

_(Amended following Loop 28 Adversarial Review - Final Revision)_

# 1. CANONICAL DOCUMENT LIFECYCLE

- **Immutability**: Financial documents (Receipts, Invoices, Repair Tickets) are immutable. They are generated exactly **once** upon a finalization event (e.g., `Sale` status becomes `COMPLETED`, `Quotation` becomes `SENT` or `ACCEPTED`).
- **Returns/Alterations**: If a sale is refunded or altered, the original receipt is never modified. A _new_ return receipt or amended quotation is generated.
- **Retrieval**: Re-printing or downloading a historical document always fetches the frozen artifact or renders from a frozen snapshot, ensuring mathematical and historical accuracy.

# 2. SNAPSHOT & DATA MODEL

To guarantee historical accuracy and backwards compatibility, the exact state of the business at the time of transaction must be preserved without breaking existing data.

- **Snapshotting**: A new field `snapshotData Json?` will be added to `Sale`, `Quotation`, and `Repair`. By making this optional, existing legacy records are migration-safe. For all new finalized documents post-migration, populating `snapshotData` is strictly required by the application logic. This JSON will capture `StoreSettings` (e.g., `receiptFooter`, `taxRegistration`, `currencyCode`) and `Branch` address exactly as they were at the time of finalization.
- **Media Linkage**: The models will optionally link to a `MediaAsset` (e.g., `documentMediaId String?`) where the canonical generated PDF is permanently stored.

# 3. GENERATION TIMING

- **Synchronous POS Print**: The thermal receipt HTML is available synchronously immediately after checkout for rapid in-store printing.
- **Asynchronous PDF Generation**: Heavy PDF generation (for email/download) is triggered asynchronously upon transaction completion. The UI will reflect a "Generating..." state if the user attempts to download it before completion.

# 4. STORAGE & ACCESS SECURITY

- **Canonical Storage**: PDFs are persisted in Firebase Cloud Storage.
- **Secure Access**: Public bucket access is strictly forbidden. The system will use an authenticated Server Action to generate and return a **short-lived signed URL** (valid for 5-10 minutes) to the client.
- **IDOR Prevention**: The signed URL endpoint will strictly enforce RBAC and branch isolation. A user cannot generate a signed URL for a `MediaAsset` they do not have branch access to.

# 5. PRINTING VS PDF STRATEGY

Both generation paths MUST consume the exact same immutable `snapshotData` payload to guarantee absolute consistency between physical and digital documents.

- **Thermal / Browser Printing (POS)**: Zero-latency in-store printing is achieved via a dedicated, hidden React component combined with strict `@media print` CSS. This bypasses PDF generation entirely and uses the browser's native print dialog.
- **PDF Generation**: For email attachments and A4 downloads, the system will use a serverless-safe library such as `@react-pdf/renderer` or `jspdf`. **Puppeteer and headless browsers are explicitly banned**.

# 6. EMAIL, RETRY & IDEMPOTENCY DESIGN

- **Explicit Logging & Retries**: We will introduce an `EmailDeliveryLog` table. Relying on Next.js `waitUntil` is insufficient for reliability if the isolate crashes. Instead, the delivery intent is recorded in the DB with `status=PENDING`. A background worker (or explicit UI trigger) processes the log.
- **Idempotency**: The `EmailDeliveryLog` uses a unique constraint (e.g., `documentId + destinationEmail + status=PENDING`) to guarantee idempotent execution.
- **Recovery**: If the email provider (e.g., Resend) fails, the state transitions to `ERROR` with the reason. The UI will expose a "Retry Email" button allowing staff to manually recover.

# 7. NUMBERING STRATEGY & COMPLIANCE

- **Preserving Existing Sequences**: The existing `sequence Int @unique @default(autoincrement())` field on `Sale`, `Quotation`, and `Repair` will remain completely unchanged to preserve backwards compatibility and internal relationships.
- **Strict Gapless Numbering**: We will add a new field `documentNumber String? @unique` to these models. This field represents the legal/business-facing identifier (e.g., `INV-BR1-00042`).
- **Transactional Generation**: A transactional `BranchSequence` table will safely generate the gapless string.
- **Enforcement**: `documentNumber` is nullable (`String?`) to remain migration-safe for historical records, but application logic will make it mandatory for all newly finalized transactions.

# 8. FAILURE & RECOVERY BEHAVIOR

- If asynchronous PDF generation fails, the `MediaAsset` state is marked as `ERROR`. The UI will detect this state and display a "Regenerate PDF" button for manual recovery.
- If thermal printing fails, staff can rely on the browser's native print retry or refresh the page, as the `snapshotData` is safely stored in the database.

# 9. CROSS-BRANCH SERVICING

- **Problem**: Strict branch isolation prevents Branch B from processing a return for a receipt from Branch A.
- **Solution**: We will introduce a restricted **Cross-Branch Lookup Action**. A staff member in Branch B can fetch a Sale from Branch A _only_ if they provide the exact `documentNumber` (or `sequence`) AND a matching verification factor (e.g., Customer Email or Last 4 digits of the card). This preserves tenant privacy while enabling cross-branch returns.

# 10. TESTING STRATEGY

- **Security**: Integration tests simulating IDOR attempts on the signed URL generation endpoint.
- **Visuals**: Snapshot testing of the thermal print HTML/CSS components to ensure margins remain strictly locked for 80mm printers.
- **Consistency**: Unit tests verifying that both the Thermal React Component and A4 PDF Generator consume the `snapshotData` identically.
- **Idempotency**: Unit testing the `EmailDeliveryLog` state machine and retry logic.

# 11. EXPLICIT OUT-OF-SCOPE ITEMS

- Direct ESC/POS network hardware printing.
- Custom drag-and-drop receipt layout builders.
- Integration of Puppeteer or Headless Chrome.
- SMS delivery of receipts (deferred to a future loop).
