# Loop 25 Dependency Review: Shift Management & Cash Drawers

## 1. Current Platform State

The STONEY Platform has successfully built out an extremely robust set of backend capabilities:

- Inventory, Procurement, and Transfers (Loops 19-23)
- Mobile API for Inventory/Procurement Execution (Loop 24)
- Sales and POS Checkout (Previous Loops)
- Repairs and Quotations (Previous Loops)

The platform is functionally capable of selling items, taking cash/card payments, managing stock levels, and receiving new stock.

## 2. Remaining Capability Gaps

Despite the comprehensive nature of the Sales and Payment domains, the system currently lacks physical **Cash Drawer and Shift Management**. When a `Payment` of type `CASH` is recorded, it is simply tied to the `Sale` and `Branch`. There is no mechanism to:

- Track which user opened the till and with what starting cash balance.
- Track "Cash In" or "Cash Out" (e.g., taking cash out of the drawer to pay a window washer, or a mid-day cash drop to a safe).
- Perform end-of-day (or end-of-shift) reconciliation (Expected Cash vs Actual Cash).
- Record discrepancies (Over/Short) securely.

For a physical retail store (POS), operating without shift reconciliation makes theft detection impossible and accounting a nightmare.

## 3. Dependency Analysis

- **Prisma Schema:** We have `Branch`, `User`, `Sale`, and `Payment`. We are missing `Shift` and `CashMovement`.
- **Business Logic:** We need to intercept the creation of `CASH` payments and optionally ensure an active shift exists for the user, or simply link the payment to an active shift.
- **Web UI:** Needs a new section (likely under `/sales/shifts` or a dedicated `/shifts` dashboard) to open, close, and manage shifts.

## 4. Candidate Next Capabilities Considered

1. **Shift Management & Cash Drawers:** Till balancing, cash handling, discrepancies.
2. **Supplier Returns / Debit Notes:** RTV (Return to Vendor) workflows.
3. **Advanced Customer Loyalty:** Points, rewards.

## 5. Why the Recommended Capability Has the Highest Priority

**Shift Management & Cash Drawers** is a hard operational blocker for production deployment in a physical retail environment. A store cannot securely accept cash without balancing the drawer. Implementing this provides the final missing piece of a true POS system, ensuring financial integrity and employee accountability.

## 6. Exact Proposed Loop 25 Scope

- **Schema:** Introduce `Shift` and `CashMovement` models.
- **Backend/Actions:** Create server actions to open shift, close shift, add/remove cash.
- **Sales Integration:** Modify the payment flow (or create hooks) to link `CASH` payments to the user's active `Shift`.
- **Web UI:** Build the Shift Management dashboard for staff to open/close their tills and managers to review historical shifts and discrepancies.

## 7. Explicit Out-of-Scope Items

- **Mobile App Integration:** Mobile Shift Management is deferred. The Web POS dashboard will be the primary interface for opening/closing tills.
- **Hardware Integrations:** Direct hardware triggers for opening a physical cash drawer via ESC/POS commands are deferred.

## 8. Schema Migration Required?

**YES.** This loop will require database schema modifications to introduce `Shift` and `CashMovement`.

## 9. Dependencies on Existing Modules

- Modifying the existing Sales/Payment actions to associate payments with shifts (or calculating shift totals dynamically based on timestamp/user).
- Existing RBAC (`sales:write`, `reports:read`, etc. plus new permissions if needed).

## 10. Recommended Next Architecture Phase

Proceed to design the `Shift` data model, the concurrency constraints for opening/closing, and the integration strategy with existing `Payment` records.

---

**READY FOR ARCHITECTURE**
