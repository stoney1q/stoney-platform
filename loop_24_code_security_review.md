# CODE REVIEW

The Mobile API Phase 6 (Inventory & Procurement) routes are clean, well-structured, and strictly adhere to the project's headless architecture design. They act exclusively as an authenticated transport layer, delegating all state-mutating business logic directly to existing server actions (`src/lib/inventory/actions.ts`, `src/lib/inventory/audit-actions.ts`, `src/lib/purchases/actions.ts`).

- API endpoints use the standardized `apiHandler` wrapper.
- Data structures are strictly typed and parsed with `zod`.
- Error mapping is central and transparent.

# SECURITY REVIEW

- **Authentication Bypass**: None found. All endpoints invoke actions that immediately call `requireAuth()`, or call `requireAuth()` directly in GET endpoints.
- **Authorization Bypass (IDOR)**: None found. Access requires explicit global/branch context. Attempting to fetch or mutate resources for an unauthorized branch results in a 403 Forbidden.
- **Branch Isolation**:
  - `GET` endpoints (`/purchases/orders`, `/inventory/transfers`, `/inventory/audits`) explicitly filter queries by `session.branchId` unless the user possesses global admin privileges.
  - State mutating endpoints rely on the battle-tested isolation checks baked into the existing actions (e.g. `requireBranchAccess(po.branchId)`).
- **Rate Limiting**: Globally enforced at 100 requests per minute via `apiHandler`.

# DATABASE REVIEW

- No schema changes were made or required.
- No direct mutations are executed by the API handlers. All database interactions preserve the transaction integrity and locking mechanisms (e.g. `SELECT ... FOR UPDATE`) provided by the underlying service layer.
- Concurrency risks (e.g., rapid repeated barcode scans) are safely mitigated via Prisma atomic operations (`increment: quantity` within `upsertAuditItem`).

# PERFORMANCE REVIEW

- Queries natively filter data based on status (e.g., `ORDERED` and `PARTIALLY_RECEIVED` for POs), returning minimal datasets ideal for mobile networks.
- No N+1 queries were introduced.
- Repeated calls from a mobile barcode scanner could theoretically hit the 100 req/min rate limit, though this operates safely within reasonable human-scanning speeds.

# TEST REVIEW

- All routes are covered by Vitest suites (`118/118` passing).
- Type checking (`tsc --noEmit`) and linting pass successfully.
- Tests adequately mock the underlying actions and `AuthError` responses.

# FINDINGS

## [LOW] Permissive Input Validation for Audit Items

**Description**: The Zod schema for `POST /api/v1/inventory/audits/[id]/items` uses `z.number().int()` for `quantity`. While a negative `increment` could arguably be used for "undo" actions on a scanner, a `mode: 'set'` payload with a negative physical quantity is logically invalid for physical stock counts.
**Recommendation**: Restrict the `quantity` schema, or add a conditional refinement so that if `mode === 'set'`, `quantity` must be `>= 0`.

# REQUIRED FIXES

None.

# OPTIONAL IMPROVEMENTS

1. Tighten the `zod` schema on `audits/[id]/items/route.ts` to strictly prohibit negative physical counts for `set` mode.

# FINAL VERDICT

PASS
