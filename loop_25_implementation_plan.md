# OBJECTIVE

Implement Shift Management & Cash Drawers (Loop 25) to provide complete reconciliation for cash payments, closing the operational gap for physical store checkouts. This includes tracking opening balances, recording cash movements, and enforcing active shifts for CASH payments.

# APPROVED ARCHITECTURE

The approved architecture (detailed in `loop_25_architecture.md`) introduces `Shift` and `CashMovement` models. It bridges the Sales domain and User/Branch domain by requiring an active `OPEN` shift for any `Payment` of method `CASH`. The Web Dashboard provides the POS interface for shift lifecycles.

# IMPLEMENTATION BOUNDARY

**In Scope:**

- Database Schema (`Shift`, `CashMovement`)
- `src/lib/shifts/actions.ts` (Shift lifecycle logic: open, close, add movement)
- Modifying `applyPayment` and `checkout` (if applicable) in `src/lib/sales/actions.ts` to require and link an active shift.
- UI at `/shifts` for shift management.

**Out of Scope:**

- Mobile API for shifts.
- Hardware cash drawer kicks (ESC/POS).
- Manager overrides of closed shifts.

# FILES TO CREATE

1. `src/lib/shifts/actions.ts`: Core shift business logic.
2. `src/lib/shifts/actions.test.ts`: Test coverage for shifts.
3. `src/lib/shifts/validation.ts`: Zod schemas for shift inputs.
4. `src/lib/shifts/dtos.ts`: Shift DTO mapping.
5. `src/app/(authenticated)/shifts/page.tsx`: Shift management UI.

# FILES TO MODIFY

1. `prisma/schema.prisma`: Add `Shift` and `CashMovement` models. Add relations to `Payment`, `Branch`, and `User`.
2. `src/lib/sales/actions.ts`: Intercept `CASH` payments. Fetch the user's active shift, enforce its existence, and link `shiftId`.
3. `src/lib/sales/actions.test.ts`: Add test cases validating that `CASH` payments fail without a shift, and succeed/link with a shift.

# FILES NOT TO TOUCH

- `src/app/api/v1/*` (Mobile API endpoints)
- `src/lib/inventory/*` (Inventory domain)
- `src/lib/purchases/*` (Procurement domain)

# DATABASE CHANGES

- `enum ShiftStatus { OPEN, CLOSED }`
- `enum CashMovementType { CASH_IN, CASH_OUT }`
- `model Shift { ... }`
- `model CashMovement { ... }`
- Add `shiftId String?` to `model Payment`.

# MIGRATION PLAN

Run `npx prisma migrate dev --name init_shift_management`. No data migration required as old `Payment` records will have `shiftId: null`.

# SERVER/API CHANGES

- **`openShift(openingBalance: number)`**: Transactional. Fails if user has an active `OPEN` shift.
- **`closeShift(id: string, closingBalance: number, notes?: string)`**: Transactional. SELECT FOR UPDATE on `Shift`. Calculates Expected = Opening + Sum(Cash Payments) + Sum(Cash In) - Sum(Cash Out). Discrepancy = Closing - Expected. Sets Status = `CLOSED`.
- **`addCashMovement(...)`**: Validates shift is `OPEN`. Adds cash movement.
- **`applyPayment(...)`**: Modified. If method is `CASH`, finds `Shift` where `userId = session.id` and `status = OPEN`. Throws if not found. Sets `payment.shiftId`.

# UI CHANGES

- `src/app/(authenticated)/shifts/page.tsx`
- **Active Shift Panel**: Shows "No active shift" or details of the current open shift (Opening Balance, Current Time).
- **Actions**: "Open Shift" (modal), "Cash In/Out" (modal), "Close Shift" (modal with physical count input).
- **History Table**: Read-only list of historical shifts for the branch, showing expected, actual, and discrepancies.

# SECURITY REQUIREMENTS

- **Authentication**: `requireAuth()` across all actions.
- **Authorization**: `sales:write` to open/close personal shift and cash movements. `sales:read` or `reports:read` to view branch history.
- **Branch Isolation**: `requireBranchAccess()` on all reads. Shifts belong strictly to `session.branchId`.
- **Concurrency Protection**: Uses `SELECT 1 FROM "Shift" WHERE id = $id FOR UPDATE` during `closeShift` to prevent payments being attached while calculations are happening. Relies on transactional reads to prevent double-opening.

# TEST PLAN

- **Unit/Integration (Shift Lifecycle)**: Open shift successfully. Try opening twice (fails). Add cash in/out. Close shift and verify exact Decimal math for expected balance and discrepancies.
- **Unit/Integration (Sales Payment Linkage)**: Attempt a CASH payment without an open shift -> Error. Attempt with an open shift -> Success and `shiftId` is recorded on the Payment. Attempt a CARD payment without an open shift -> Success (shifts are only required for CASH).

# VALIDATION PLAN

1. `npx prisma validate`
2. `npx vitest run src/lib/shifts src/lib/sales`
3. `npm run lint`
4. `npx tsc --noEmit`

# GIT CHECKPOINT PLAN

Upon successful implementation and test execution, review with `stoney-reviewer`, fix issues with `stoney-hardener`, and finally checkpoint using `stoney-checkpoint`.

# ROLLBACK/RECOVERY PLAN

- If `prisma migrate` fails, run `git reset --hard` and `git clean -fd`.
- Database rollback via manual Prisma shadow restoration if data corruption occurs during local dev (unlikely, as this is purely additive).
