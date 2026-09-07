import { Shift, CashMovement, User, Prisma } from '@/generated/prisma/client';

export type ShiftWithRelations = Shift & {
  user?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  cashMovements?: CashMovement[];
};

export type SafeShiftDTO = Omit<
  Shift,
  'openingBalance' | 'closingBalance' | 'expectedBalance' | 'discrepancy'
> & {
  openingBalance: string;
  closingBalance?: string;
  expectedBalance?: string;
  discrepancy?: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  cashMovements?: SafeCashMovementDTO[];
};

export type SafeCashMovementDTO = Omit<
  CashMovement,
  'amount' | 'createdById'
> & {
  amount: string;
};

export function toSafeShiftDTO(shift: ShiftWithRelations): SafeShiftDTO {
  return {
    ...shift,
    openingBalance: shift.openingBalance.toFixed(2),
    closingBalance: shift.closingBalance?.toFixed(2),
    expectedBalance: shift.expectedBalance?.toFixed(2),
    discrepancy: shift.discrepancy?.toFixed(2),
    cashMovements: shift.cashMovements?.map((cm) => ({
      ...cm,
      amount: cm.amount.toFixed(2),
      createdById: undefined,
    })) as SafeCashMovementDTO[] | undefined,
  };
}
