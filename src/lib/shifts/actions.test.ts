import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  openShift,
  closeShift,
  addCashMovement,
  getActiveShift,
  getHistoricalShifts,
} from './actions';
import {
  PaymentMethod,
  ShiftStatus,
  CashMovementType,
} from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';

function createFormData(data: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) {
    fd.append(k, v);
  }
  return fd;
}

vi.mock('@/lib/auth/guard', () => ({
  requireAuth: vi.fn(),
  requirePermission: vi.fn(),
  requireBranchAccess: vi.fn(),
}));

describe('Shift Actions', () => {
  const mockUser = {
    id: 'user-1',
    branchId: 'branch-1',
    role: { name: 'Cashier' },
  };
  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
    await prisma.cashMovement.deleteMany({
      where: { shift: { branchId: 'branch-1' } },
    });
    await prisma.payment.deleteMany({
      where: { sale: { branchId: 'branch-1' } },
    });
    await prisma.shift.deleteMany({ where: { branchId: 'branch-1' } });
    await prisma.branch.upsert({
      where: { id: 'branch-1' },
      update: {},
      create: { id: 'branch-1', name: 'Branch 1', code: 'BR1' },
    });
    const role = await prisma.role.upsert({
      where: { name: 'Cashier' },
      update: {},
      create: { name: 'Cashier' },
    });
    await prisma.user.upsert({
      where: { email: 'user1@example.com' },
      update: {},
      create: {
        id: 'user-1',
        email: 'user1@example.com',
        firstName: 'User',
        lastName: 'One',
        branchId: 'branch-1',
        roleId: role.id,
      },
    });
  });

  describe('openShift', () => {
    it('should open a shift successfully', async () => {
      const fd = createFormData({ openingBalance: '100.00', notes: 'Morning' });
      const shift = await openShift(fd);
      expect(shift.status).toBe(ShiftStatus.OPEN);
      expect(shift.openingBalance).toBe('100.00');
    });

    it('should fail if user already has an open shift', async () => {
      await openShift(createFormData({ openingBalance: '100.00' }));
      await expect(
        openShift(createFormData({ openingBalance: '50.00' }))
      ).rejects.toThrow('already have an open shift');
    });
  });

  describe('closeShift', () => {
    it('should close a shift and calculate correct discrepancy', async () => {
      const shift = await openShift(
        createFormData({ openingBalance: '100.00' })
      );

      // Expected: 100.00. Close with 105.00 -> Discrepancy: +5.00
      const fd = createFormData({
        shiftId: shift.id,
        closingBalance: '105.00',
      });
      const closed = await closeShift(fd);

      expect(closed.status).toBe(ShiftStatus.CLOSED);
      expect(closed.expectedBalance).toBe('100.00');
      expect(closed.closingBalance).toBe('105.00');
      expect(closed.discrepancy).toBe('5.00');
    });
  });

  describe('addCashMovement', () => {
    it('should add cash in and cash out', async () => {
      const shift = await openShift(
        createFormData({ openingBalance: '100.00' })
      );

      await addCashMovement(
        createFormData({
          shiftId: shift.id,
          type: CashMovementType.CASH_IN,
          amount: '50.00',
          reason: 'Change load',
        })
      );

      await addCashMovement(
        createFormData({
          shiftId: shift.id,
          type: CashMovementType.CASH_OUT,
          amount: '20.00',
          reason: 'Supplies',
        })
      );

      const active = await getActiveShift();
      expect(active?.expectedBalance).toBe('130.00'); // 100 + 50 - 20
    });
  });
});
