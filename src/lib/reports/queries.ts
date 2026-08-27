import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/guard';
import { resolveDateRangeUTCBounds } from './utils';
import {
  ReportParams,
  SalesStatusDTO,
  RepairStatusDTO,
  QuotationStatusDTO,
  InventoryMovementDTO,
  SalesReportDTO,
} from './types';

/**
 * Helper to determine the strictly scoped branchId.
 * Ignores requestedBranchId if the user does not have admin:global permissions.
 */
async function resolveReportScope(requestedBranchId?: string) {
  const user = await requirePermission('reports:read');

  if (
    user.role.name === 'Super Admin' ||
    user.permissions.includes('admin:global')
  ) {
    return requestedBranchId ? { branchId: requestedBranchId } : {};
  }

  return { branchId: user.branchId };
}

export async function getSalesRevenueReport(
  params?: ReportParams
): Promise<SalesReportDTO[]> {
  const scope = await resolveReportScope(params?.branchId);
  const { start, end } = resolveDateRangeUTCBounds(params?.dateRange);

  // Group by local business date.
  // We use $queryRaw because Prisma groupBy on dates truncates to UTC boundaries, which may shift local days.
  const branchCondition =
    'branchId' in scope
      ? Prisma.sql`AND "branchId" = ${scope.branchId}`
      : Prisma.empty;

  const businessTimezone = process.env.BUSINESS_TIMEZONE || 'UTC';

  const result = await prisma.$queryRaw<
    Array<{ dateStr: string; revenue: Prisma.Decimal; txCount: bigint }>
  >`
    SELECT 
      TO_CHAR("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${businessTimezone}, 'YYYY-MM-DD') as "dateStr",
      SUM("total") as "revenue",
      COUNT("id") as "txCount"
    FROM "Sale"
    WHERE "status" = 'COMPLETED'
      AND "createdAt" >= ${start}
      AND "createdAt" <= ${end}
      ${branchCondition}
    GROUP BY "dateStr"
    ORDER BY "dateStr" ASC
  `;

  return result.map((r) => ({
    date: r.dateStr,
    revenue: (r.revenue || new Prisma.Decimal(0)).toFixed(2),
    transactionCount: Number(r.txCount || 0),
  }));
}

export async function getSalesStatusReport(
  params?: ReportParams
): Promise<SalesStatusDTO[]> {
  const scope = await resolveReportScope(params?.branchId);
  const { start, end } = resolveDateRangeUTCBounds(params?.dateRange);

  const groups = await prisma.sale.groupBy({
    by: ['status'],
    _count: { id: true },
    _sum: { total: true },
    where: {
      ...scope,
      createdAt: { gte: start, lte: end },
    },
  });

  return groups.map((g) => ({
    status: g.status,
    count: g._count.id,
    revenue: (g._sum.total || new Prisma.Decimal(0)).toFixed(2),
  }));
}

export async function getRepairStatusReport(
  params?: ReportParams
): Promise<RepairStatusDTO[]> {
  const scope = await resolveReportScope(params?.branchId);
  const { start, end } = resolveDateRangeUTCBounds(params?.dateRange);

  const groups = await prisma.repair.groupBy({
    by: ['status'],
    _count: { id: true },
    where: {
      ...scope,
      createdAt: { gte: start, lte: end },
    },
  });

  return groups.map((g) => ({
    status: g.status,
    count: g._count.id,
  }));
}

export async function getQuotationStatusReport(
  params?: ReportParams
): Promise<QuotationStatusDTO[]> {
  const scope = await resolveReportScope(params?.branchId);
  const { start, end } = resolveDateRangeUTCBounds(params?.dateRange);

  const groups = await prisma.quotation.groupBy({
    by: ['status'],
    _count: { id: true },
    where: {
      ...scope,
      createdAt: { gte: start, lte: end },
    },
  });

  return groups.map((g) => ({
    status: g.status,
    count: g._count.id,
  }));
}

export async function getInventoryMovementReport(
  params?: ReportParams
): Promise<InventoryMovementDTO[]> {
  const scope = await resolveReportScope(params?.branchId);
  const { start, end } = resolveDateRangeUTCBounds(params?.dateRange);

  const groups = await prisma.stockMovement.groupBy({
    by: ['type'],
    _count: { id: true },
    _sum: { quantity: true },
    where: {
      ...scope,
      createdAt: { gte: start, lte: end },
    },
  });

  return groups.map((g) => ({
    type: g.type,
    count: g._count.id,
    quantity: g._sum.quantity || 0,
  }));
}
