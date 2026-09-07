# DOMAIN DEPENDENCY REVIEW

## CURRENT STATE

- Stoney Platform possesses a full-featured web-based backend for advanced inventory and procurement in `src/lib/inventory` and `src/lib/purchases`.
- The database schema (`prisma/schema.prisma`) natively supports `StockAudit`, `StockAuditItem`, `PurchaseOrder`, `Transfer`, `BranchStock`, and `StockMovement`.
- Concurrency control and atomic checkout are battle-tested in PostgreSQL via `$executeRaw` for transfers, and transactional locking (`SELECT ... FOR UPDATE`) for audits.
- The Mobile API Phase 5 foundation (`src/lib/api/handler.ts`, `src/lib/api/rate-limit.ts`) and Sales checkout endpoints exist, but mobile clients currently cannot:
  1. Retrieve active Stock Audits and submit counted quantities via barcode scans.
  2. Retrieve pending Purchase Orders and submit received goods on the loading dock.
  3. Retrieve pending Transfers to dispatch or receive items.

## DEPENDENCIES

- **Prisma Database Models**: `StockAudit`, `PurchaseOrder`, `Transfer`, `BranchStock`, `StockMovement`, `Product`.
- **Security & Authorization**: `requireAuth`, `requirePermission`, `requireBranchAccess` from `src/lib/auth/guard.ts`.
- **Domain Business Logic**: `src/lib/inventory/audit-actions.ts`, `src/lib/purchases/actions.ts`, `src/lib/inventory/actions.ts`.
- **API Middleware**: `src/lib/api/handler.ts` for CORS, rate limiting, and standardized error translation.

## DOMAIN BOUNDARIES

- The Mobile API under `src/app/api/v1/` acts strictly as an authenticated transport layer.
- All endpoints must wrap execution using `apiHandler`.
- For state-mutating actions (Counting stock, Receiving POs, Dispatching/Receiving Transfers), route handlers MUST strictly delegate to the pre-existing server actions in `src/lib/` to preserve concurrency and data-integrity guarantees.
- For data retrieval (GET), route handlers may invoke `prisma` directly for specialized filtering (e.g., retrieving only `ORDERED` Purchase Orders), provided they enforce branch isolation.

## SECURITY MODEL

- **Authentication**: All endpoints require active authentication (`requireAuth()`), accepting Firebase ID tokens via the `Authorization: Bearer <token>` header or session cookies.
- **Role-Based Access Control (RBAC)**:
  - `GET /api/v1/inventory/audits`: Requires `inventory:read`
  - `POST /api/v1/inventory/audits/[id]/items`: Requires `inventory:write`
  - `GET /api/v1/purchases/orders`: Requires `purchases:read`
  - `POST /api/v1/purchases/orders/[id]/receive`: Requires `purchases:write`
  - `GET /api/v1/inventory/transfers`: Requires `inventory:read`
  - `POST /api/v1/inventory/transfers/[id]/dispatch`: Requires `transfers:write`
  - `POST /api/v1/inventory/transfers/[id]/receive`: Requires `transfers:write`
- **Branch Isolation**:
  - API results are strictly isolated to the user's assigned branch (`user.branchId`), unless they have global access (`admin:global`).
  - Mutating actions will intrinsically throw a 403 error via `requireBranchAccess` built into the underlying server actions if the user's branch does not match the resource's branch.

## DATA MODEL

- **Zero Schema Changes**: All entities already exist in `prisma/schema.prisma`.
- **Zero Migrations**: No database migrations are required.

## API/SERVER ACTION DESIGN

### 1. Stock Audits

**`GET /api/v1/inventory/audits`**

- **Auth**: `inventory:read`
- **Behavior**: Retrieves a list of `IN_PROGRESS` audits for the user's branch. Uses `prisma.stockAudit.findMany`.

**`GET /api/v1/inventory/audits/[id]`**

- **Auth**: `inventory:read`
- **Behavior**: Delegates to `getAuditById(id)`. Returns the full audit including items to allow the mobile app to sync expected lists.

**`POST /api/v1/inventory/audits/[id]/items`**

- **Auth**: `inventory:write`
- **Body**: `{ "productId": "cuid...", "quantity": 1, "mode": "increment" | "set" }`
- **Behavior**: Delegates to `upsertAuditItem(id, productId, quantity, mode)`.
- **Purpose**: Mobile scanner will repeatedly send `increment` by 1 as barcodes are scanned.

### 2. Purchase Orders

**`GET /api/v1/purchases/orders`**

- **Auth**: `purchases:read`
- **Behavior**: Queries `prisma.purchaseOrder.findMany` where `status` is `ORDERED` or `PARTIALLY_RECEIVED` for the user's branch.

**`POST /api/v1/purchases/orders/[id]/receive`**

- **Auth**: `purchases:write`
- **Body**: `{ "items": [{ "productId": "cuid...", "receivedQuantity": 10 }] }`
- **Behavior**: Delegates to `receivePurchaseOrder(id, payload)`.

### 3. Inter-Branch Transfers

**`GET /api/v1/inventory/transfers`**

- **Auth**: `inventory:read`
- **Behavior**: Queries `prisma.transfer.findMany` where the user's branch is either `originId` (and status is `PENDING`) or `destinationId` (and status is `IN_TRANSIT`). Returns two lists: `outgoing` and `incoming`.

**`POST /api/v1/inventory/transfers/[id]/dispatch`**

- **Auth**: `transfers:write`
- **Behavior**: Delegates to `dispatchTransfer(id)`.

**`POST /api/v1/inventory/transfers/[id]/receive`**

- **Auth**: `transfers:write`
- **Behavior**: Delegates to `receiveTransfer(id)`.

## UI ARCHITECTURE

- No Web UI modifications are required. This loop is exclusively creating headless REST API routes for the mobile application.

## PERFORMANCE

- **Repeated Barcode Scans**: The mobile scanner might send rapid `/audits/[id]/items` requests (e.g. scanning 10 identical items in 5 seconds). The `apiHandler` rate limit of 100 req/min will protect the database, but clients should ideally batch scans on-device to avoid limits, or the limit can be slightly relaxed if needed (deferred).
- **Lightweight Payloads**: GET endpoints only return necessary DTO subsets where possible to conserve bandwidth on cellular networks.

## CONCURRENCY

- **Atomic Operations**: All state mutations rely on existing PostgreSQL transactions, `$executeRaw` atomic adjustments, and `SELECT ... FOR UPDATE` locks written in previous loops.
- **Race Conditions**: Parallel scanners working on the same Audit ID will safely stack increments because `upsertAuditItem` utilizes Prisma `increment: quantity` atomic operations.

## OBSERVABILITY

- All routes utilize `apiHandler`, ensuring errors (Zod, Prisma constraint violations, Auth) are logged centrally and normalized for the client.

## TESTING STRATEGY

- **Route Tests**:
  - `src/app/api/v1/inventory/audits/route.test.ts`
  - `src/app/api/v1/inventory/audits/[id]/items/route.test.ts` (Ensures `increment` correctly delegates to `upsertAuditItem`)
  - `src/app/api/v1/purchases/orders/route.test.ts`
  - `src/app/api/v1/purchases/orders/[id]/receive/route.test.ts`
  - `src/app/api/v1/inventory/transfers/route.test.ts`
  - `src/app/api/v1/inventory/transfers/[id]/dispatch/route.test.ts`
  - `src/app/api/v1/inventory/transfers/[id]/receive/route.test.ts`
- **Security Tests**: Validate that a user in Branch A cannot receive a Purchase Order scoped to Branch B, or dispatch a Transfer from Branch B.

## DATABASE/MIGRATION IMPACT

- **Migrations Required**: NO.
- **Database Drift Risk**: Zero.

## RISKS

- **Network Interruptions**: If a mobile scanner drops network during `POST /audits/[id]/items`, the app won't know if the increment succeeded. The mobile app should support viewing the real-time counted quantities to self-verify if retry is needed.
- **Rate Limiting vs Scanning Speed**: The 100 req/min global limit might be hit by a fast barcode scanner if the mobile app submits 1 request per scan. The mobile app must batch inputs, or the server must eventually increase rate limits. (Current limit is sufficient for initial testing).

## DEFERRED SCOPE

- **Offline Mode Synchronization**: True offline caching and bulk sync of audit counts is a mobile client-side architectural concern and deferred from the backend API.
- **WebSocket/Real-time Updates**: Pushing live audit counts to other devices in real-time is deferred. The client will rely on polling or pull-to-refresh.

## ACCEPTANCE CRITERIA

1. `GET /api/v1/inventory/audits` returns branch-scoped active audits.
2. `POST /api/v1/inventory/audits/[id]/items` successfully applies atomic increments to an active audit count via existing actions.
3. `GET /api/v1/purchases/orders` returns active POs.
4. `POST /api/v1/purchases/orders/[id]/receive` successfully applies received items via existing actions.
5. `GET /api/v1/inventory/transfers` returns both pending outgoing and incoming in-transit transfers for the user's branch.
6. `POST /api/v1/inventory/transfers/[id]/dispatch` and `receive` successfully execute state transitions and stock movements.
7. Full regression test suite (`npx vitest run`, `npx tsc --noEmit`, `npm run lint`) passes with 0 errors.

## IMPLEMENTATION STAGES

1. **Stage 1: Stock Audits Mobile API**
   - Implement `GET /api/v1/inventory/audits`
   - Implement `GET /api/v1/inventory/audits/[id]`
   - Implement `POST /api/v1/inventory/audits/[id]/items`
   - Write tests.
2. **Stage 2: Purchase Orders Mobile API**
   - Implement `GET /api/v1/purchases/orders`
   - Implement `POST /api/v1/purchases/orders/[id]/receive`
   - Write tests.
3. **Stage 3: Transfers Mobile API**
   - Implement `GET /api/v1/inventory/transfers`
   - Implement `POST /api/v1/inventory/transfers/[id]/dispatch`
   - Implement `POST /api/v1/inventory/transfers/[id]/receive`
   - Write tests.
4. **Stage 4: Hardening & Verification**
   - Execute full test suite, linting, type-checking.

---

**READY FOR IMPLEMENTATION: YES**
