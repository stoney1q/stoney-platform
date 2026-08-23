import 'server-only';
import { Prisma } from '@/generated/prisma/client';
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

  const [
    todayAgg,
    weekAgg,
    pendingSalesAgg,
    pendingPaymentsAgg,
    completedCount,
  ] = await Promise.all([
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
    // Pending total of all PENDING sales
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        branchId,
        status: 'PENDING',
      },
    }),
    // Sum of all payments applied to PENDING sales
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        sale: {
          branchId,
          status: 'PENDING',
        },
      },
    }),
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

  const pendingSalesTotal = pendingSalesAgg._sum.total || new Prisma.Decimal(0);
  const pendingPaymentsApplied =
    pendingPaymentsAgg._sum.amount || new Prisma.Decimal(0);

  // Pending payment amount is the total of all pending sales minus any partial payments already made
  const pendingOutstanding = pendingSalesTotal.minus(pendingPaymentsApplied);

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
