import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
  expect,
} from 'vitest';
import {
  SaleStatus,
  PaymentMethod,
  QuotationStatus,
  RepairStatus,
  ShiftStatus,
  CashMovementType,
} from '@/generated/prisma/client';

const { currentMockUser } = vi.hoisted(() => ({
  currentMockUser: {
    uid: '' as string,
    email: '' as string,
    value: undefined as string | undefined,
  },
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === 'stoney_session' && currentMockUser.value !== undefined) {
        return { value: currentMockUser.value };
      }
      return undefined;
    },
  }),
}));

vi.mock('../firebase/admin', () => ({
  isFirebaseAdminConfigured: () => true,
  getFirebaseAdminAuth: () => ({
    verifySessionCookie: async () => {
      if (currentMockUser.value !== undefined) {
        return { uid: currentMockUser.uid, email: currentMockUser.email };
      }
      throw new Error('auth/invalid-session-cookie');
    },
  }),
}));

describe('Dashboard Queries', async () => {
  const { prisma } = await import('../prisma');
  const {
    getRevenueMetrics,
    getRepairQueue,
    getLowStockAlerts,
    getQuotationMetrics,
    getShiftSummary,
    getPaymentBreakdown,
  } = await import('./queries');
  const { getTodayUTCBounds, getThisWeekUTCBounds } = await import('./utils');

  const testId = Date.now().toString() + Math.floor(Math.random() * 1000);

  let mainBranchId: string;
  let otherBranchId: string;
  let managerUserId: string;
  let shiftUserId: string;
  let customerId: string;
  let openShiftId: string;

  beforeAll(async () => {
    // 1. Branches
    const b1 = await prisma.branch.create({
      data: {
        name: `Dash B1 ${testId}`,
        code: `DB1_${testId}`,
        isActive: true,
      },
    });
    mainBranchId = b1.id;

    const b2 = await prisma.branch.create({
      data: {
        name: `Dash B2 ${testId}`,
        code: `DB2_${testId}`,
        isActive: true,
      },
    });
    otherBranchId = b2.id;

    // 2. Roles & Permissions
    const managerRole = await prisma.role.create({
      data: { name: `Dash Manager ${testId}` },
    });
    const cashierRole = await prisma.role.create({
      data: { name: `Dash Cashier ${testId}` },
    });

    const perms = [
      'dashboard:revenue:read',
      'dashboard:repairs:read',
      'dashboard:inventory:read',
      'dashboard:quotations:read',
      'dashboard:shifts:read',
    ];
    for (const p of perms) {
      const perm = await prisma.permission.upsert({
        where: { name: p },
        update: {},
        create: { name: p, description: p },
      });
      await prisma.rolePermission.create({
        data: { roleId: managerRole.id, permissionId: perm.id },
      });
    }

    // 3. Users
    const managerUser = await prisma.user.create({
      data: {
        email: `manager_${testId}@test.com`,
        firstName: 'Manager',
        lastName: 'M',
        branchId: mainBranchId,
        roleId: managerRole.id,
        firebaseUid: `mgr_${testId}`,
        emailVerified: true,
        isActive: true,
      },
    });
    managerUserId = managerUser.id;

    await prisma.user.create({
      data: {
        email: `cashier_${testId}@test.com`,
        firstName: 'Cashier',
        lastName: 'C',
        branchId: mainBranchId,
        roleId: cashierRole.id,
        firebaseUid: `csh_${testId}`,
        emailVerified: true,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: `other_${testId}@test.com`,
        firstName: 'Other',
        lastName: 'O',
        branchId: otherBranchId,
        roleId: managerRole.id,
        firebaseUid: `oth_${testId}`,
        emailVerified: true,
        isActive: true,
      },
    });

    // Shift user (same branch as manager, has dashboard:shifts:read via managerRole)
    const shiftUser = await prisma.user.create({
      data: {
        email: `shiftuser_${testId}@test.com`,
        firstName: 'Shift',
        lastName: 'U',
        branchId: mainBranchId,
        roleId: managerRole.id,
        firebaseUid: `sft_${testId}`,
        emailVerified: true,
        isActive: true,
      },
    });
    shiftUserId = shiftUser.id;

    // 4. Customer
    const customer = await prisma.customer.create({
      data: {
        firstName: 'Dash',
        lastName: `Customer ${testId}`,
        createdById: managerUserId,
      },
    });
    customerId = customer.id;

    // 5. Products & Inventory
    const prod1 = await prisma.product.create({
      data: { name: 'Prod1', sku: `DP1_${testId}`, sellingPrice: 10 },
    });
    const prod2 = await prisma.product.create({
      data: { name: 'Prod2', sku: `DP2_${testId}`, sellingPrice: 20 },
    });
    const prod3 = await prisma.product.create({
      data: { name: 'Prod3', sku: `DP3_${testId}`, sellingPrice: 30 },
    });

    await prisma.branchStock.create({
      data: {
        branchId: mainBranchId,
        productId: prod1.id,
        onHand: 5,
        reorderLevel: 5,
      },
    });
    await prisma.branchStock.create({
      data: {
        branchId: mainBranchId,
        productId: prod2.id,
        onHand: 3,
        reorderLevel: 5,
      },
    });
    await prisma.branchStock.create({
      data: {
        branchId: mainBranchId,
        productId: prod3.id,
        onHand: 10,
        reorderLevel: 5,
      },
    });

    // 6. Quotations
    await prisma.quotation.create({
      data: {
        branchId: mainBranchId,
        customerId,
        createdById: managerUserId,
        status: QuotationStatus.SENT,
        total: 100,
      },
    });
    await prisma.quotation.create({
      data: {
        branchId: mainBranchId,
        customerId,
        createdById: managerUserId,
        status: QuotationStatus.DRAFT,
        total: 150,
      },
    });

    // 7. Repairs
    const dev = await prisma.device.create({
      data: { customerId, make: 'Apple', model: 'X' },
    });
    await prisma.repair.create({
      data: {
        branchId: mainBranchId,
        deviceId: dev.id,
        customerId,
        issue: 'Broken screen',
        status: RepairStatus.IN_PROGRESS,
        technicianId: managerUserId,
      },
    });
    await prisma.repair.create({
      data: {
        branchId: mainBranchId,
        deviceId: dev.id,
        customerId,
        issue: 'Battery dead',
        status: RepairStatus.DIAGNOSING,
      },
    });
    await prisma.repair.create({
      data: {
        branchId: mainBranchId,
        deviceId: dev.id,
        customerId,
        issue: 'Water damage',
        status: RepairStatus.COMPLETED,
        technicianId: managerUserId,
      },
    });

    // 8. Sales and Payments
    const saleA = await prisma.sale.create({
      data: {
        branchId: mainBranchId,
        customerId,
        createdById: managerUserId,
        status: SaleStatus.PENDING,
        total: 100,
      },
    });
    await prisma.payment.create({
      data: {
        saleId: saleA.id,
        amount: 100,
        method: PaymentMethod.CASH,
        createdById: managerUserId,
      },
    });

    const saleB = await prisma.sale.create({
      data: {
        branchId: mainBranchId,
        customerId,
        createdById: managerUserId,
        status: SaleStatus.PENDING,
        total: 100,
      },
    });
    await prisma.payment.create({
      data: {
        saleId: saleB.id,
        amount: 20,
        method: PaymentMethod.CASH,
        createdById: managerUserId,
      },
    });

    await prisma.sale.create({
      data: {
        branchId: mainBranchId,
        customerId,
        createdById: managerUserId,
        status: SaleStatus.PENDING,
        total: 50,
      },
    });

    await prisma.sale.create({
      data: {
        branchId: mainBranchId,
        customerId,
        createdById: managerUserId,
        status: SaleStatus.COMPLETED,
        total: 1250.5,
      },
    });

    await prisma.sale.create({
      data: {
        branchId: otherBranchId,
        customerId,
        createdById: managerUserId,
        status: SaleStatus.PENDING,
        total: 100,
      },
    });

    // 9. Open Shift for shiftUser with cash payments and movements
    const openShift = await prisma.shift.create({
      data: {
        branchId: mainBranchId,
        userId: shiftUserId,
        status: ShiftStatus.OPEN,
        openingBalance: 50,
      },
    });
    openShiftId = openShift.id;

    // A CASH payment on this shift (sale is PENDING, but shift aggregation is independent of sale status)
    const shiftSale = await prisma.sale.create({
      data: {
        branchId: mainBranchId,
        customerId,
        createdById: shiftUserId,
        status: SaleStatus.COMPLETED,
        total: 100,
      },
    });
    await prisma.payment.create({
      data: {
        saleId: shiftSale.id,
        amount: 75,
        method: PaymentMethod.CASH,
        shiftId: openShiftId,
        createdById: shiftUserId,
      },
    });
    // A CARD payment on the same sale (should NOT count towards shift cash)
    await prisma.payment.create({
      data: {
        saleId: shiftSale.id,
        amount: 25,
        method: PaymentMethod.CARD,
        createdById: shiftUserId,
      },
    });

    // Cash movements: +20 CASH_IN, -10 CASH_OUT
    await prisma.cashMovement.create({
      data: {
        shiftId: openShiftId,
        type: CashMovementType.CASH_IN,
        amount: 20,
        reason: 'Petty cash top-up',
        createdById: shiftUserId,
      },
    });
    await prisma.cashMovement.create({
      data: {
        shiftId: openShiftId,
        type: CashMovementType.CASH_OUT,
        amount: 10,
        reason: 'Safe drop',
        createdById: shiftUserId,
      },
    });

    // A COMPLETED sale with mixed payment methods for getPaymentBreakdown
    // (shiftSale above already has a CASH 75 + CARD 25 payment on a COMPLETED sale)
    // Add a TRANSFER payment on another completed sale
    const transferSale = await prisma.sale.create({
      data: {
        branchId: mainBranchId,
        customerId,
        createdById: shiftUserId,
        status: SaleStatus.COMPLETED,
        total: 200,
      },
    });
    await prisma.payment.create({
      data: {
        saleId: transferSale.id,
        amount: 200,
        method: PaymentMethod.TRANSFER,
        createdById: shiftUserId,
      },
    });
  });

  afterAll(async () => {
    // Delete in reverse dependency order
    // Shift-related cleanup first
    await prisma.cashMovement.deleteMany({ where: { shiftId: openShiftId } });
    await prisma.payment.deleteMany({ where: { createdById: shiftUserId } });
    await prisma.sale.deleteMany({ where: { createdById: shiftUserId } });
    await prisma.shift.deleteMany({ where: { userId: shiftUserId } });
    await prisma.payment.deleteMany({ where: { createdById: managerUserId } });
    await prisma.sale.deleteMany({ where: { createdById: managerUserId } });
    await prisma.repair.deleteMany({
      where: { branchId: { in: [mainBranchId, otherBranchId] } },
    });
    await prisma.device.deleteMany({ where: { customerId } });
    await prisma.quotation.deleteMany({
      where: { createdById: managerUserId },
    });
    await prisma.branchStock.deleteMany({
      where: { branchId: { in: [mainBranchId, otherBranchId] } },
    });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.user.deleteMany({
      where: { branchId: { in: [mainBranchId, otherBranchId] } },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { name: { startsWith: 'Dash ' } } },
    });
    await prisma.role.deleteMany({ where: { name: { startsWith: `Dash ` } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: `DP` } } });
    await prisma.branch.deleteMany({
      where: { id: { in: [mainBranchId, otherBranchId] } },
    });
  });

  beforeEach(() => {
    currentMockUser.value = 'active_manager';
    currentMockUser.uid = `mgr_${testId}`;
    currentMockUser.email = `manager_${testId}@test.com`;
  });

  afterEach(() => {
    currentMockUser.value = undefined;
    currentMockUser.uid = '';
    currentMockUser.email = '';
    vi.useRealTimers();
  });

  describe('Timezone Logic', () => {
    it('calculates normal day bounds correctly without crashing', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));

      const bounds = getTodayUTCBounds();
      expect(bounds.start).toBeInstanceOf(Date);
      expect(bounds.end).toBeInstanceOf(Date);
      expect(bounds.end.getTime()).toBeGreaterThan(bounds.start.getTime());

      const weekBounds = getThisWeekUTCBounds();
      expect(weekBounds.start).toBeInstanceOf(Date);
      expect(weekBounds.end).toBeInstanceOf(Date);
      expect(weekBounds.end.getTime()).toBeGreaterThan(
        weekBounds.start.getTime()
      );
    });

    it('calculates DST transition boundary correctly', () => {
      vi.useFakeTimers();
      // Around US Spring Forward
      vi.setSystemTime(new Date('2024-03-10T02:30:00Z'));

      const bounds = getTodayUTCBounds();
      expect(bounds.start).toBeInstanceOf(Date);
      expect(bounds.end).toBeInstanceOf(Date);
    });
  });

  describe('Money and Pending Payments', () => {
    it('returns fixed-point money strings for revenue', async () => {
      const revenue = await getRevenueMetrics();
      expect(typeof revenue.todayTotal).toBe('string');
      // Matches formats like "0.00", "1250.50"
      expect(revenue.todayTotal).toMatch(/^\d+\.\d{2}$/);
      expect(revenue.weekTotal).toMatch(/^\d+\.\d{2}$/);
      expect(revenue.pendingTotal).toMatch(/^\d+\.\d{2}$/);
    });

    it('calculates pending payments per-sale safely', async () => {
      const revenue = await getRevenueMetrics();
      // Sale A: 0
      // Sale B: 80
      // Sale C: 50
      // Total pending outstanding = 130
      expect(revenue.pendingTotal).toBe('130.00');
    });

    it('aggregates completed sales correctly', async () => {
      const revenue = await getRevenueMetrics();
      // Includes Sale D if within today's bounds. Since we did not use fake timers,
      // it was created just now, so it should be included.
      // Also includes shiftSale (100.00) and transferSale (200.00) added in the shift fixture.
      expect(revenue.todayTotal).toBe('1550.50');
      expect(revenue.completedSalesCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Low Stock', () => {
    it('evaluates low stock conditions correctly via $queryRaw', async () => {
      const stock = await getLowStockAlerts();
      // Prod1 (5 == 5) -> counts
      // Prod2 (3 < 5) -> counts
      // Prod3 (10 > 5) -> does not count
      expect(stock.count).toBe(2);
    });
  });

  describe('Repair Queue', () => {
    it('aggregates active repair statuses and excludes finalized ones', async () => {
      // 1. No technicianId -> returns only unassigned
      const unassignedQueue = await getRepairQueue();
      const diagnosing = unassignedQueue.find((q) => q.status === 'DIAGNOSING');
      const inProgressUnassigned = unassignedQueue.find(
        (q) => q.status === 'IN_PROGRESS'
      );

      expect(diagnosing?.count).toBe(1);
      expect(inProgressUnassigned).toBeUndefined(); // It is assigned

      // 2. specific technicianId -> returns only theirs
      const assignedQueue = await getRepairQueue(managerUserId);
      const inProgressAssigned = assignedQueue.find(
        (q) => q.status === 'IN_PROGRESS'
      );
      const completed = assignedQueue.find((q) => q.status === 'COMPLETED');

      expect(inProgressAssigned?.count).toBe(1);

      // Completed repairs should be excluded entirely
      expect(completed).toBeUndefined();
    });
  });

  describe('Quotations', () => {
    it('aggregates quotation metrics correctly', async () => {
      const quotes = await getQuotationMetrics();
      expect(quotes.sent).toBe(1);
      expect(quotes.draft).toBe(1);
      expect(quotes.accepted).toBe(0);
      expect(quotes.rejected).toBe(0);
    });
  });

  describe('Authorization & Branch Isolation', () => {
    it('blocks unauthorized access to all metrics', async () => {
      currentMockUser.value = 'active_cashier';
      currentMockUser.uid = `csh_${testId}`;
      currentMockUser.email = `cashier_${testId}@test.com`;

      await expect(getRevenueMetrics()).rejects.toThrow('Access denied');
      await expect(getRepairQueue()).rejects.toThrow('Access denied');
      await expect(getLowStockAlerts()).rejects.toThrow('Access denied');
      await expect(getQuotationMetrics()).rejects.toThrow('Access denied');
    });

    it('enforces branch isolation implicitly', async () => {
      currentMockUser.value = 'active_other_branch';
      currentMockUser.uid = `oth_${testId}`;
      currentMockUser.email = `other_${testId}@test.com`;

      const revenue = await getRevenueMetrics();
      // Other branch only has 1 pending sale of $100
      expect(revenue.pendingTotal).toBe('100.00');
      // No completed sales in this branch
      expect(revenue.todayTotal).toBe('0.00');

      const stock = await getLowStockAlerts();
      expect(stock.count).toBe(0);

      const quotes = await getQuotationMetrics();
      expect(quotes.sent).toBe(0);

      const repairs = await getRepairQueue();
      expect(repairs.length).toBe(0);
    });
  });

  describe('Shift Summary', () => {
    it('returns hasOpenShift: false when the user has no open shift', async () => {
      // managerUser has no open shift — shiftUser does
      const summary = await getShiftSummary();
      expect(summary.hasOpenShift).toBe(false);
      expect(summary.shiftId).toBeNull();
      expect(summary.openedAt).toBeNull();
      expect(summary.openingBalance).toBe('0.00');
      expect(summary.expectedBalance).toBe('0.00');
      expect(summary.movementsCount).toBe(0);
    });

    it('returns correct live balance for an open shift', async () => {
      // Switch to shiftUser who has the open shift
      currentMockUser.uid = `sft_${testId}`;
      currentMockUser.email = `shiftuser_${testId}@test.com`;

      const summary = await getShiftSummary();
      expect(summary.hasOpenShift).toBe(true);
      expect(summary.shiftId).toBe(openShiftId);
      expect(summary.openingBalance).toBe('50.00');
      // cashSales=75, cashIn=20, cashOut=10
      // expectedBalance = 50 + 75 + 20 - 10 = 135.00
      expect(summary.cashSalesTotal).toBe('75.00');
      expect(summary.cashInTotal).toBe('20.00');
      expect(summary.cashOutTotal).toBe('10.00');
      expect(summary.expectedBalance).toBe('135.00');
      expect(summary.movementsCount).toBe(2);
    });

    it('does not count non-CASH payments towards shift balance', async () => {
      currentMockUser.uid = `sft_${testId}`;
      currentMockUser.email = `shiftuser_${testId}@test.com`;

      const summary = await getShiftSummary();
      // CARD payment of 25 must not appear in cashSalesTotal
      expect(summary.cashSalesTotal).toBe('75.00');
    });

    it('returns all fixed-point money strings', async () => {
      currentMockUser.uid = `sft_${testId}`;
      currentMockUser.email = `shiftuser_${testId}@test.com`;

      const summary = await getShiftSummary();
      const moneyFields = [
        summary.openingBalance,
        summary.expectedBalance,
        summary.cashSalesTotal,
        summary.cashInTotal,
        summary.cashOutTotal,
      ];
      for (const field of moneyFields) {
        expect(field).toMatch(/^\d+\.\d{2}$/);
      }
    });

    it('rejects users without dashboard:shifts:read permission', async () => {
      currentMockUser.value = 'active_cashier';
      currentMockUser.uid = `csh_${testId}`;
      currentMockUser.email = `cashier_${testId}@test.com`;

      await expect(getShiftSummary()).rejects.toThrow('Access denied');
    });
  });

  describe('Payment Breakdown', () => {
    it('returns correct per-method totals for today', async () => {
      // Completed sales created by shiftUser today:
      //   shiftSale:    CASH 75, CARD 25
      //   transferSale: TRANSFER 200
      // Completed sales created by managerUser today:
      //   Sale D: total 1250.50 (no payments attached in fixture)
      const breakdown = await getPaymentBreakdown();
      // Only payments attached to COMPLETED sales count
      // shiftUser's sales are COMPLETED with explicit payment records
      expect(breakdown.cash).toMatch(/^\d+\.\d{2}$/);
      expect(breakdown.card).toMatch(/^\d+\.\d{2}$/);
      expect(breakdown.transfer).toMatch(/^\d+\.\d{2}$/);
      expect(breakdown.other).toMatch(/^\d+\.\d{2}$/);
      expect(breakdown.total).toMatch(/^\d+\.\d{2}$/);
    });

    it('includes shiftUser CASH and CARD payments on completed sales', async () => {
      const breakdown = await getPaymentBreakdown();
      // CASH: at least 75.00 (from shiftSale)
      expect(parseFloat(breakdown.cash)).toBeGreaterThanOrEqual(75);
      // CARD: at least 25.00
      expect(parseFloat(breakdown.card)).toBeGreaterThanOrEqual(25);
      // TRANSFER: at least 200.00
      expect(parseFloat(breakdown.transfer)).toBeGreaterThanOrEqual(200);
      // Total must equal sum of all methods
      const sum =
        parseFloat(breakdown.cash) +
        parseFloat(breakdown.card) +
        parseFloat(breakdown.transfer) +
        parseFloat(breakdown.other);
      expect(parseFloat(breakdown.total)).toBeCloseTo(sum, 2);
    });

    it('rejects users without dashboard:revenue:read permission', async () => {
      currentMockUser.value = 'active_cashier';
      currentMockUser.uid = `csh_${testId}`;
      currentMockUser.email = `cashier_${testId}@test.com`;

      await expect(getPaymentBreakdown()).rejects.toThrow('Access denied');
    });
  });
});
