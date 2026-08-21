# Loop 03 — Inventory Domain

## Objective

Design and implement the foundational Inventory module to support:

- Products and Suppliers
- Materialized Branch Stock balances
- Immutable Stock Movement ledger (audit trail)
- Inter-branch Transfers

## Architecture

**Hybrid Inventory Model:**

- `BranchStock`: Materialized current stock balance (fast reads).
- `StockMovement`: Immutable append-only audit ledger (historical accuracy).

All stock-changing operations execute inside PostgreSQL transactions wrapping both a `BranchStock` update and a `StockMovement` creation.

Stock consumption (negative adjustment, dispatch transfer) uses atomic raw SQL conditional updates (`UPDATE "BranchStock" SET "onHand" = "onHand" - X WHERE ... AND "onHand" - "reserved" >= X`) to ensure concurrency safety without relying on application-level locks.

## Data Models

- **Product**: Core SKU and catalog details.
- **Supplier**: Vendor details.
- **ProductSupplier**: Join table linking products and suppliers.
- **BranchStock**: Tracks `onHand` and `reserved` stock per `[branchId, productId]`.
- **StockMovement**: Immutable log with `type` (e.g., RECEIPT, ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT).
- **Transfer**: Inter-branch logistic requests with state transitions (PENDING, IN_TRANSIT, COMPLETED, CANCELLED).

## Implementation Details

1. **Schema**: Migrated database with above models and enums.
2. **Server Actions**: `src/lib/inventory/actions.ts` provides fully-tested atomic transaction handlers for receiving stock, adjusting stock, and processing transfers.
3. **Tests**: Covered logic in `src/lib/inventory/actions.test.ts`. 100% tests passing.
4. **UI Conceptual Shell**: `src/app/(authenticated)/inventory/*` layout and placeholder pages for Products, Branch Stock, Stock Movements, and Transfers created with Shadcn UI.
5. **Permissions**: Seeded `inventory:read`, `inventory:write`, `transfers:read`, `transfers:write` and updated Role assignments appropriately.

## Next Steps

In future loops, actual UI forms and real-time state management can be attached to the existing Server Actions. Sales, Repairs, and Purchase Order workflows will hook into this system to reserve and consume stock.
