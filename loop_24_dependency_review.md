# Loop 24 Dependency Review: Mobile API Phase 6 (Inventory & Procurement)

## 1. Current Platform State

The STONEY Platform has successfully completed a massive backend push establishing advanced inventory and procurement domains. Recent loops have introduced:

- Supplier Management (Loop 19)
- Branch-to-Branch Transfers (Loop 20)
- Sales Returns & Refunds (Loop 21)
- Purchase Orders (Loop 22)
- Stock Audits & Reconciliation (Loop 23)

All of these are fully functional on the Web Dashboard. The Mobile API, however, was last updated in Phase 5 (Loop 18 - Sales Checkout) and Phase 4 (Loop 17 - Media).

## 2. Remaining Capability Gaps

While the web interface allows managers to create Audits, Purchase Orders, and Transfers, the actual _operational execution_ of these workflows (walking the store floor, scanning barcodes, receiving boxes on the loading dock) is intrinsically a mobile-first activity. The Mobile App currently lacks the REST endpoints to participate in these new domains.

## 3. Dependency Analysis

- **Prisma Schema:** Models for `StockAudit`, `PurchaseOrder`, `Transfer`, and `StockMovement` are already deployed and battle-tested.
- **Business Logic:** Server actions for these domains (`src/lib/inventory/audit-actions.ts`, `src/lib/purchases/actions.ts`, etc.) are fully implemented with transactional safety and concurrency controls.
- **Mobile Infrastructure:** API routing (`apiHandler`), Auth guarding (`requireAuth`, `requirePermission`), rate limiting, and CORS are fully established under `src/app/api/v1/`.

## 4. Candidate Next Capabilities Considered

1. **Mobile API Phase 6 (Inventory & Procurement):** Exposing Audits, PO Receiving, and Transfers to the mobile client.
2. **Shift Management & Cash Drawers:** Adding physical till balancing for the POS.
3. **Supplier Returns / Debit Notes:** Handling RTV (Return to Vendor) workflows.

## 5. Why the Recommended Capability Has the Highest Priority

**Mobile API Phase 6 (Inventory & Procurement)** is the single highest-value capability because it unlocks the physical hardware ROI of the mobile application. Performing a Stock Audit or receiving a Purchase Order via a Web Dashboard requires a laptop on a rolling cart. Exposing these to the Mobile API allows staff to use their phone's camera to scan barcodes and rapidly input quantities directly from the warehouse floor. This bridges the gap between the complex Web backend built in Loops 19-23 and the operational reality of retail staff.

## 6. Exact Proposed Loop 24 Scope

Implementation of the following Mobile API endpoint groupings under `src/app/api/v1/`:

- **Stock Audits:**
  - `GET /api/v1/inventory/audits` (List active branch audits)
  - `GET /api/v1/inventory/audits/[id]` (View audit items)
  - `POST /api/v1/inventory/audits/[id]/items` (Submit physical count via barcode scan)
- **Purchase Orders (Receiving):**
  - `GET /api/v1/purchases/orders` (List `ORDERED` or `PARTIALLY_RECEIVED` POs for the branch)
  - `POST /api/v1/purchases/orders/[id]/receive` (Submit received quantities for items)
- **Transfers (Dispatch & Receive):**
  - `GET /api/v1/inventory/transfers` (List pending IN/OUT transfers)
  - `POST /api/v1/inventory/transfers/[id]/dispatch`
  - `POST /api/v1/inventory/transfers/[id]/receive`

## 7. Explicit Out-of-Scope Items

- **Web UI Modifications:** The Web Dashboard is already feature-complete for these domains.
- **Creation of POs/Audits on Mobile:** The Mobile API will strictly focus on _execution_ (counting, receiving, dispatching). Creating complex Purchase Orders or scoping Full Store Audits remains a Web Manager responsibility.
- **Cash Drawer / Shift Management:** Deferred to a future loop.

## 8. Schema Migration Required?

**NO.** The existing Prisma schema supports all required workflows.

## 9. Dependencies on Existing Modules

- Relies heavily on `apiHandler` for routing.
- Relies on existing RBAC (`inventory:read`, `inventory:write`, `purchases:read`, `purchases:write`).
- Will act as a transport layer wrapping the existing hardened server actions.

## 10. Recommended Next Architecture Phase

Proceed to design the REST payload contracts, response structures, and exact action delegation patterns for the new `/api/v1/` endpoints.

---

**READY FOR ARCHITECTURE**
