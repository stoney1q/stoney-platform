import 'server-only';
import {
  Prisma,
  ShiftStatus,
  CashMovementType,
  PaymentMethod,
} from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/guard';
import { getTodayUTCBounds, getThisWeekUTCBounds } from './utils';

type Money = string;

export interface RevenueMetricsDTO {
  todayTotal: Money;
  weekTotal: Money;
  pendingTotal: Money;
  completedSalesCount: number;
}

export interface RepairQueueDTO {
  status: string;
  count: number;
}

export interface QuotationMetricsDTO {
  draft: number;
  sent: number;
  accepted: number;
  rejected: number;
}

export interface LowStockAlertDTO {
  count: number;
}

/**
 * Returns revenue metrics for the authenticated user's branch.
 * Requires 'dashboard:revenue:read' permission.
 */
export async function getRevenueMetrics(): Promise<RevenueMetricsDTO> {
  const user = await requirePermission('dashboard:revenue:read');
  const branchId = user.branchId;

  const { start: todayStart, end: todayEnd } = getTodayUTCBounds();
  const { start: weekStart, end: weekEnd } = getThisWeekUTCBounds();

  console.time('dashboard:revenue');

  const [todayAgg, weekAgg, pendingResult, completedCount] = await Promise.all([
    // Today's completed revenue
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        branchId,
        status: 'COMPLETED',
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    // This week's completed revenue
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        branchId,
        status: 'COMPLETED',
        createdAt: { gte: weekStart, lte: weekEnd },
      },
    }),
    // Pending payment amount: per-sale calculation
    prisma.$queryRaw<
      Array<{ pendingTotal: Prisma.Decimal | number | string | null }>
    >`
      SELECT SUM(s.total - COALESCE(p."paidAmount", 0)) as "pendingTotal"
      FROM "Sale" s
      LEFT JOIN (
        SELECT "saleId", SUM(amount) as "paidAmount"
        FROM "Payment"
        GROUP BY "saleId"
      ) p ON s.id = p."saleId"
      WHERE s."branchId" = ${branchId} AND s.status = 'PENDING'
    `,
    // Count of today's completed sales
    prisma.sale.count({
      where: {
        branchId,
        status: 'COMPLETED',
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    }),
  ]);

  console.timeEnd('dashboard:revenue');

  const pendingRaw = pendingResult[0]?.pendingTotal;
  const pendingOutstanding = new Prisma.Decimal(pendingRaw?.toString() || '0');

  return {
    todayTotal: (todayAgg._sum.total || new Prisma.Decimal(0)).toFixed(2),
    weekTotal: (weekAgg._sum.total || new Prisma.Decimal(0)).toFixed(2),
    pendingTotal: pendingOutstanding.toFixed(2),
    completedSalesCount: completedCount,
  };
}

/**
 * Returns the repair queue grouped by status for a specific technician,
 * or unassigned if no technician ID is provided.
 * Requires 'dashboard:repairs:read' permission.
 */
export async function getRepairQueue(
  technicianId?: string
): Promise<RepairQueueDTO[]> {
  const user = await requirePermission('dashboard:repairs:read');
  const branchId = user.branchId;

  console.time('dashboard:repairs');

  const groups = await prisma.repair.groupBy({
    by: ['status'],
    _count: { id: true },
    where: {
      branchId,
      technicianId: technicianId === undefined ? null : technicianId,
      status: {
        notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED'],
      },
    },
  });

  console.timeEnd('dashboard:repairs');

  return groups.map((g) => ({
    status: g.status,
    count: g._count.id,
  }));
}

/**
 * Returns count of low and out-of-stock items for the user's branch.
 * Requires 'dashboard:inventory:read' permission.
 */
export async function getLowStockAlerts(): Promise<LowStockAlertDTO> {
  const user = await requirePermission('dashboard:inventory:read');
  const branchId = user.branchId;

  console.time('dashboard:inventory');

  // Prisma does not support field-to-field comparison in standard where clauses (onHand <= reorderLevel)
  // We use $queryRaw to perform this count safely at the database level.
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count 
    FROM "BranchStock" 
    WHERE "branchId" = ${branchId} 
      AND "onHand" <= "reorderLevel"
  `;

  console.timeEnd('dashboard:inventory');

  return {
    count: Number(result[0]?.count || 0),
  };
}

/**
 * Returns quotation metrics for the user's branch.
 * Requires 'dashboard:quotations:read' permission.
 */
export async function getQuotationMetrics(): Promise<QuotationMetricsDTO> {
  const user = await requirePermission('dashboard:quotations:read');
  const branchId = user.branchId;

  console.time('dashboard:quotations');

  const groups = await prisma.quotation.groupBy({
    by: ['status'],
    _count: { id: true },
    where: {
      branchId,
    },
  });

  console.timeEnd('dashboard:quotations');

  const metrics: QuotationMetricsDTO = {
    draft: 0,
    sent: 0,
    accepted: 0,
    rejected: 0,
  };
  for (const group of groups) {
    if (group.status === 'DRAFT') metrics.draft = group._count.id;
    if (group.status === 'SENT') metrics.sent = group._count.id;
    if (group.status === 'ACCEPTED') metrics.accepted = group._count.id;
    if (group.status === 'REJECTED') metrics.rejected = group._count.id;
  }

  return metrics;
}

// ==========================================
// SHIFT SUMMARY
// ==========================================

export interface ShiftSummaryDTO {
  hasOpenShift: boolean;
  shiftId: string | null;
  openedAt: string | null;
  openingBalance: string;
  expectedBalance: string;
  cashSalesTotal: string;
  cashInTotal: string;
  cashOutTotal: string;
  movementsCount: number;
}

/**
 * Returns the authenticated user's active shift summary for the dashboard.
 * If no shift is open, returns hasOpenShift: false with all-zero balances.
 * Requires 'dashboard:shifts:read' permission.
 */
export async function getShiftSummary(): Promise<ShiftSummaryDTO> {
  const user = await requirePermission('dashboard:shifts:read');

  console.time('dashboard:shifts');

  const shift = await prisma.shift.findFirst({
    where: {
      userId: user.id,
      status: ShiftStatus.OPEN,
    },
    include: {
      payments: true,
      cashMovements: true,
    },
  });

  console.timeEnd('dashboard:shifts');

  if (!shift) {
    return {
      hasOpenShift: false,
      shiftId: null,
      openedAt: null,
      openingBalance: '0.00',
      expectedBalance: '0.00',
      cashSalesTotal: '0.00',
      cashInTotal: '0.00',
      cashOutTotal: '0.00',
      movementsCount: 0,
    };
  }

  // Aggregate in memory — shifts have < 200 payments and < 20 movements
  let cashSalesTotal = new Prisma.Decimal(0);
  for (const p of shift.payments) {
    if (p.method === PaymentMethod.CASH) {
      cashSalesTotal = cashSalesTotal.add(p.amount);
    }
  }

  let cashInTotal = new Prisma.Decimal(0);
  let cashOutTotal = new Prisma.Decimal(0);
  for (const cm of shift.cashMovements) {
    if (cm.type === CashMovementType.CASH_IN) {
      cashInTotal = cashInTotal.add(cm.amount);
    } else {
      cashOutTotal = cashOutTotal.add(cm.amount);
    }
  }

  const expectedBalance = shift.openingBalance
    .add(cashSalesTotal)
    .add(cashInTotal)
    .sub(cashOutTotal);

  return {
    hasOpenShift: true,
    shiftId: shift.id,
    openedAt: shift.openedAt.toISOString(),
    openingBalance: shift.openingBalance.toFixed(2),
    expectedBalance: expectedBalance.toFixed(2),
    cashSalesTotal: cashSalesTotal.toFixed(2),
    cashInTotal: cashInTotal.toFixed(2),
    cashOutTotal: cashOutTotal.toFixed(2),
    movementsCount: shift.cashMovements.length,
  };
}

// ==========================================
// PAYMENT METHOD BREAKDOWN
// ==========================================

export interface PaymentBreakdownDTO {
  cash: string;
  card: string;
  transfer: string;
  other: string;
  total: string;
}

/**
 * Returns today's payment totals grouped by method for completed sales in
 * the authenticated user's branch.
 * Requires 'dashboard:revenue:read' permission.
 */
export async function getPaymentBreakdown(): Promise<PaymentBreakdownDTO> {
  const user = await requirePermission('dashboard:revenue:read');
  const branchId = user.branchId;

  const { start: todayStart, end: todayEnd } = getTodayUTCBounds();

  console.time('dashboard:payment-breakdown');

  const payments = await prisma.payment.findMany({
    where: {
      sale: {
        branchId,
        status: 'COMPLETED',
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    },
    select: { method: true, amount: true },
  });

  console.timeEnd('dashboard:payment-breakdown');

  let cash = new Prisma.Decimal(0);
  let card = new Prisma.Decimal(0);
  let transfer = new Prisma.Decimal(0);
  let other = new Prisma.Decimal(0);

  for (const p of payments) {
    if (p.method === PaymentMethod.CASH) cash = cash.add(p.amount);
    else if (p.method === PaymentMethod.CARD) card = card.add(p.amount);
    else if (p.method === PaymentMethod.TRANSFER)
      transfer = transfer.add(p.amount);
    else other = other.add(p.amount);
  }

  const total = cash.add(card).add(transfer).add(other);

  return {
    cash: cash.toFixed(2),
    card: card.toFixed(2),
    transfer: transfer.toFixed(2),
    other: other.toFixed(2),
    total: total.toFixed(2),
  };
}
