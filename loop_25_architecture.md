# DOMAIN DEPENDENCY REVIEW

## CURRENT STATE

- The STONEY Platform supports POS Checkout, Quotations, and Repairs.
- Financial transactions are recorded in the `Payment` model.
- There is currently no concept of a "Till", "Cash Drawer", or "Shift", which is a fundamental requirement for a physical retail environment to reconcile daily cash takings and detect theft.

## DEPENDENCIES

- **Prisma Schema**: `Branch`, `User`, `Payment` (existing models).
- **Security & Authorization**: Existing RBAC and branch isolation frameworks (`src/lib/auth/guard.ts`).
- **Domain Business Logic**: `src/lib/sales/actions.ts` (specifically the `createPayment` and `checkout` functions which need to link cash payments to an active shift).

## DOMAIN BOUNDARIES

- The **Shift Management** domain is isolated to physical branch operations.
- It bridges the **Sales** domain (Payments) and the **Branch/User** domain (Staff attendance/till accountability).
- Shifts are strictly tied to a single `Branch` and typically a single `User` who is responsible for that till session.

## SECURITY MODEL

- **Authentication**: All actions require active authentication.
- **RBAC**:
  - Opening/closing a personal shift: `sales:write`
  - Viewing all branch shifts/discrepancies: `sales:read` or `reports:read`
  - Adding Cash In/Out: `sales:write`
- **Branch Isolation**: A user can only open a shift in their assigned branch. A manager can only view shifts for their assigned branch.

## DATA MODEL

We will introduce two new models and modify one existing model in `prisma/schema.prisma`.

### New Models:

```prisma
enum ShiftStatus {
  OPEN
  CLOSED
}

enum CashMovementType {
  CASH_IN
  CASH_OUT
}

model Shift {
  id             String      @id @default(cuid())
  sequence       Int         @unique @default(autoincrement())
  status         ShiftStatus @default(OPEN)

  branchId       String
  userId         String

  openingBalance Decimal     @db.Decimal(10, 2)
  closingBalance Decimal?    @db.Decimal(10, 2)
  expectedBalance Decimal?   @db.Decimal(10, 2)
  discrepancy    Decimal?    @db.Decimal(10, 2)
  notes          String?

  branch         Branch      @relation(fields: [branchId], references: [id])
  user           User        @relation(fields: [userId], references: [id])

  payments       Payment[]
  cashMovements  CashMovement[]

  openedAt       DateTime    @default(now())
  closedAt       DateTime?

  @@index([branchId, status])
  @@index([userId, status])
}

model CashMovement {
  id          String           @id @default(cuid())
  shiftId     String
  type        CashMovementType
  amount      Decimal          @db.Decimal(10, 2)
  reason      String

  createdById String

  shift       Shift @relation(fields: [shiftId], references: [id], onDelete: Cascade)
  createdBy   User  @relation(fields: [createdById], references: [id])

  createdAt   DateTime @default(now())
}
```

### Modified Models:

- `Payment`: Add `shiftId String?` and `shift Shift? @relation(fields: [shiftId], references: [id])`.
- `Branch`: Add `shifts Shift[]`.
- `User`: Add `shifts Shift[]`.

## API/SERVER ACTION DESIGN

**`src/lib/shifts/actions.ts`**

- `openShift(openingBalance: number)`: Checks if the user already has an `OPEN` shift. If not, creates a new `Shift`.
- `closeShift(id: string, closingBalance: number, notes?: string)`: Calculates `expectedBalance` = `openingBalance` + sum(CASH payments) + sum(CASH_IN) - sum(CASH_OUT). Sets `discrepancy` = `closingBalance` - `expectedBalance`. Marks status as `CLOSED`.
- `addCashMovement(shiftId: string, type: CashMovementType, amount: number, reason: string)`: Records a cash drop or payout.
- `getActiveShift()`: Retrieves the current user's active shift.

**Modifications to `src/lib/sales/actions.ts`**

- When a `Payment` of method `CASH` is created, the system MUST find the user's active shift and link the payment via `shiftId`. If no active shift exists, it should throw an error requiring the user to open a shift first (configurable based on branch settings, but strictly enforced for now).

## UI ARCHITECTURE

- **New Page:** `src/app/(authenticated)/shifts/page.tsx` (Shift Dashboard)
  - Shows current active shift status (Open/Closed).
  - Button to "Open Shift" (modal asking for starting float/balance).
  - Button to "Close Shift" (modal asking for physical cash count).
  - Button to "Cash In / Out" (modal for drops/payouts).
  - Data table showing historical shifts for the branch (for managers).
- **POS Checkout Integration:** The checkout UI should ideally warn the user if they attempt a cash sale without an open shift.

## PERFORMANCE

- Calculating the `expectedBalance` at shift close involves aggregating payments and cash movements. Since shifts are typically daily and tied to a single user, the number of records will be extremely small (< 200). Standard Prisma aggregations (`aggregate`) are perfectly performant.

## CONCURRENCY

- **Opening Shifts:** A user should only have ONE `OPEN` shift at a time. The `openShift` action must use a transaction and ideally a unique constraint on `(userId, status)` (though Prisma doesn't support partial unique constraints natively without raw SQL, we can rely on a fast transactional read-before-write or explicit application-level locking).
- **Closing Shifts:** When closing, the system must lock the shift row (`SELECT ... FOR UPDATE`) to prevent concurrent payments from being added while the expected balance is calculated.

## OBSERVABILITY

- All cash discrepancies > $0 should be logged or flagged in a Dashboard widget in a future loop.

## TESTING STRATEGY

- Unit tests for `openShift`, `closeShift`, and `addCashMovement`.
- Integration tests ensuring that `createPayment({ method: 'CASH' })` successfully links to an active shift and correctly fails if no shift exists.
- Mathematical tests ensuring `expectedBalance` and `discrepancy` calculation logic is flawless.

## DATABASE/MIGRATION IMPACT

- **Migrations Required**: YES. `npx prisma migrate dev --name init_shift_management` will be required.
- **Backwards Compatibility**: Existing `Payment` records will have `shiftId: null`. The system must tolerate null shift associations for historical data.

## RISKS

- **Orphaned Cash Payments**: If a user forgets to open a shift, they might be blocked from checking out a customer. The UI must elegantly guide them to open a shift without losing their cart state.

## DEFERRED SCOPE

- **Hardware Drawer Kicks**: Sending ESC/POS commands to physically pop the cash drawer open.
- **Z-Read / X-Read Receipt Printing**: Printing end-of-shift physical receipts.
- **Manager Overrides**: Allowing a manager to retroactively edit a closed shift.

## ACCEPTANCE CRITERIA

1. Prisma schema updated and migrated with `Shift` and `CashMovement`.
2. Server actions implemented for Shift lifecycle (Open, Close, Cash In/Out).
3. Sales checkout logic updated to strictly require an active shift for `CASH` payments and correctly link them.
4. Web UI deployed at `/shifts` allowing staff to open/close tills and perform cash movements.
5. `expectedBalance` and `discrepancy` logic verified to be mathematically accurate.

## IMPLEMENTATION STAGES

1. **Stage 1: Schema & Migrations** - Update `schema.prisma`, run migration.
2. **Stage 2: Core Actions** - Implement `src/lib/shifts/actions.ts` with atomic concurrency.
3. **Stage 3: Sales Integration** - Update checkout actions to link `CASH` payments.
4. **Stage 4: Web UI** - Build `/shifts` interface and modals.
5. **Stage 5: Hardening & Testing** - Write unit/integration tests and verify mathematically.

---

**READY FOR IMPLEMENTATION: YES**
