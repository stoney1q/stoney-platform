# CODE REVIEW

The implementation of Stock Audits (Loop 23) successfully covers the lifecycle from counting to reconciliation. The architecture and DB schema match the requested domain models, supporting branch isolation, user tracking, and variance snapshots.

# SECURITY REVIEW

**Input Validation**: `zod` schemas ensure quantities are positive integers and required IDs are present.
**Authorization**: `requireBranchAccess` and `requirePermission('inventory:write')` are correctly applied across mutating actions. Branch isolation holds up in queries.
**SQL Injection**: The raw SQL query in `completeAudit` uses tagged template literals (`${...}`) properly, which Prisma automatically parameterizes. No SQL injection vulnerability found.

# DATABASE REVIEW

**Race Condition in `upsertAuditItem` (HIGH)**:
When `mode === 'increment'`, the code calculates the new quantity in memory:
`newQuantity = existing.countedQuantity + quantity`
Then performs a Prisma `upsert` with the calculated value. In an environment with multiple counters (e.g. scanning barcodes simultaneously), two concurrent requests will read the same `existing.countedQuantity`, add 1, and update it to the same new total, resulting in a lost count.

**Race Condition in `completeAudit` (MEDIUM)**:
The `completeAudit` function attempts to lock the audit row using `const audit = await tx.stockAudit.findUnique(...)` with a comment `// Lock the audit`. However, Prisma's `findUnique` inside an interactive transaction _does not_ issue a `SELECT ... FOR UPDATE` row-level lock.
If two users click "Approve" concurrently:

1. Both read the audit in `REVIEW` status.
2. Both proceed to iterate over items.
3. The `BranchStock` row-level locks prevent double-adjustments of stock (the second transaction will calculate a 0 variance since the first one already synced the onHand).
4. However, the second transaction will overwrite the `StockAuditItem.variance` to `0`, effectively erasing the historical record of the audit variance.
   To fix this, the `StockAudit` itself must be locked at the start of the transaction via `$queryRaw` and `FOR UPDATE`.

# PERFORMANCE REVIEW

The reconciliation process properly orders items by `productId: 'asc'` before acquiring locks, successfully avoiding deadlocks. `findMany` queries efficiently include necessary relationships and counts.

# TEST REVIEW

Tests comprehensively check status transitions and point-in-time calculation isolation. However, the tests did not catch the `upsertAuditItem` increment race condition because the test `increments counted items` runs sequentially.

# FINDINGS

1. **[HIGH]** Read-modify-write race condition in `upsertAuditItem` when multiple users increment the same product.
2. **[MEDIUM]** Missing explicit row-level lock on `StockAudit` during `completeAudit`, leading to potential variance record corruption upon concurrent approvals.

# REQUIRED FIXES

1. **Fix `upsertAuditItem`**: Delegate the increment operation to the database engine using Prisma's atomic operations instead of calculating it in memory.
   ```typescript
   update: mode === 'increment'
     ? { countedQuantity: { increment: quantity } }
     : { countedQuantity: quantity },
   ```
2. **Fix `completeAudit`**: Acquire a row-level lock on the `StockAudit` immediately at the start of the transaction to prevent concurrent approvals from racing.
   ```typescript
   const auditLock =
     await tx.$queryRaw`SELECT status FROM "StockAudit" WHERE id = ${auditId} FOR UPDATE`;
   if (auditLock[0].status !== 'REVIEW')
     throw new Error('Audit must be in REVIEW status');
   ```

# OPTIONAL IMPROVEMENTS

- None blocking.

# FINAL VERDICT

**PASS WITH FINDINGS**
Handing over to `stoney-hardener` to apply the required fixes.
