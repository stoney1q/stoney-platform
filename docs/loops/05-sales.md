# Loop 05 - Sales Foundation

## Objective

Design and implement the production-ready Sales Foundation for Stoney Platform, including canonical entities (`Sale`, `SaleItem`, `Payment`) and atomic checkout functionality, while serving as the basis for future integrations.

## Architecture Highlights

- **Atomic Checkout**: The payment and inventory consumption is executing atomically in a single PostgreSQL transaction to ensure data integrity.
- **Immutable Commercial Snapshots**: `SaleItem` records the `sku` and `productName` at the time of the sale, preventing future product renames or SKU changes from affecting historical sales records.
- **Server-Side Pricing**: Prices and discounts are processed on the server as exact `Decimal` types. Discounts are strictly monetary, avoiding float-based percentage calculation errors.

## Implemented Features

- **Database Architecture**: `Sale`, `SaleItem`, `Payment` tables, along with `SaleStatus` and `PaymentMethod` enums.
- **Security & Authorization**: `sales:read`, `sales:create`, `sales:cancel` granular permissions mapping. Branch isolation achieved through `requireBranchAccess` validation.
- **Server Actions**: `searchSales`, `getSale`, `createSale`, `addSaleItem`, `removeSaleItem`, `applyPayment`, `cancelSale`.
- **UI Components**:
  - `/sales`: Searchable and paginated list of sales.
  - `/sales/new`: Entry point to create a sale by picking a customer.
  - `/sales/[id]`: Detailed view containing sale items, payments, point of sale logic, and a real-time summary.

## Verification

- ✅ **Tests**: 11/11 passing tests for Sales actions, verifying atomic checkouts, deductions, invalid inputs, and security boundaries.
- ✅ **Build Check**: 0 type errors on `next build`.
- ✅ **Static Analysis**: ESLint and Prisma validation passing.
