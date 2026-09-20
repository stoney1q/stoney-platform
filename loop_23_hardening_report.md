# CODE HARDENING REPORT

## 1. Finding: Race Condition in `upsertAuditItem` (HIGH)

- **Root Cause**: The function used a read-modify-write pattern (`newQuantity = existing.countedQuantity + quantity`) in JavaScript instead of relying on atomic database operations. This caused concurrent scans to overwrite each other.
- **Change**: Updated `upsertAuditItem` to use Prisma's `increment` capability for the database `update` clause (`{ countedQuantity: { increment: quantity } }`).
- **Security/Correctness Impact**: Ensures 100% accurate count incrementing even when multiple scanners ping the API concurrently.
- **Regression Test**: Added `prevents lost updates during concurrent increments` test in `audit-actions.test.ts`.

## 2. Finding: Race Condition in `completeAudit` (MEDIUM)

- **Root Cause**: The function checked the audit status and retrieved it via `tx.stockAudit.findUnique`, which does not issue a row-level lock. This allowed concurrent API calls to bypass the status check before the first transaction completed.
- **Change**: Replaced the `findUnique` fetch at the start of the transaction with a `SELECT status FROM "StockAudit" WHERE id = ${auditId} FOR UPDATE` raw query lock.
- **Security/Correctness Impact**: Enforces serial execution of audit completion requests, preventing double-application and ledger variance corruption.
- **Regression Test**: Added `prevents double completion due to missing explicit row lock` test in `audit-actions.test.ts`.
