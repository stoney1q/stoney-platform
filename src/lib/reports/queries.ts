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
  ProductPerformanceDTO,
  ProfitabilityDTO,
  ShiftReconciliationDTO,
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

export async function getProductPerformanceReport(
  params?: ReportParams
): Promise<ProductPerformanceDTO[]> {
  const scope = await resolveReportScope(params?.branchId);
  const { start, end } = resolveDateRangeUTCBounds(params?.dateRange);

  const branchCondition =
    'branchId' in scope
      ? Prisma.sql`AND s."branchId" = ${scope.branchId}`
      : Prisma.empty;

  const result = await prisma.$queryRaw<
    Array<{
      productId: string;
      sku: string;
      productName: string;
      quantitySold: bigint;
      revenue: Prisma.Decimal;
    }>
  >`
    WITH DiscountedItems AS (
      SELECT
        si."productId",
        si."sku",
        si."productName",
        si."quantity",
        si."total" * (
          CASE
            WHEN (s."subtotal" + s."taxAmount") > 0 THEN s."total" / (s."subtotal" + s."taxAmount")
            ELSE 1
          END
        ) as "proportionalRevenue"
      FROM "SaleItem" si
      JOIN "Sale" s ON s."id" = si."saleId"
      WHERE s."status" = 'COMPLETED'
        AND s."createdAt" >= ${start}
        AND s."createdAt" <= ${end}
        ${branchCondition}
    )
    SELECT
      "productId",
      "sku",
      "productName",
      SUM("quantity") as "quantitySold",
      SUM("proportionalRevenue") as "revenue"
    FROM DiscountedItems
    GROUP BY "productId", "sku", "productName"
    ORDER BY "revenue" DESC
    LIMIT 50
  `;

  return result.map((r) => ({
    productId: r.productId,
    sku: r.sku,
    productName: r.productName,
    quantitySold: Number(r.quantitySold || 0),
    revenue: (r.revenue || new Prisma.Decimal(0)).toFixed(2),
  }));
}

export async function getProfitabilityReport(
  params?: ReportParams
): Promise<ProfitabilityDTO[]> {
  const scope = await resolveReportScope(params?.branchId);
  const { start, end } = resolveDateRangeUTCBounds(params?.dateRange);

  const branchCondition =
    'branchId' in scope
      ? Prisma.sql`AND s."branchId" = ${scope.branchId}`
      : Prisma.empty;

  const businessTimezone = process.env.BUSINESS_TIMEZONE || 'UTC';

  const result = await prisma.$queryRaw<
    Array<{
      dateStr: string;
      revenue: Prisma.Decimal;
      cogs: Prisma.Decimal;
    }>
  >`
    WITH SaleCOGS AS (
      SELECT
        "saleId",
        SUM("unitCost" * "quantity") as "cogs"
      FROM "SaleItem"
      GROUP BY "saleId"
    )
    SELECT
      TO_CHAR(s."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${businessTimezone}, 'YYYY-MM-DD') as "dateStr",
      SUM(s."total") as "revenue",
      SUM(sc."cogs") as "cogs"
    FROM "Sale" s
    JOIN SaleCOGS sc ON s."id" = sc."saleId"
    WHERE s."status" = 'COMPLETED'
      AND s."createdAt" >= ${start}
      AND s."createdAt" <= ${end}
      ${branchCondition}
    GROUP BY "dateStr"
    ORDER BY "dateStr" ASC
  `;

  return result.map((r) => {
    const rev = Number(r.revenue || 0);
    const cost = Number(r.cogs || 0);
    const grossProfit = rev - cost;
    const margin = rev > 0 ? (grossProfit / rev) * 100 : 0;

    return {
      date: r.dateStr,
      revenue: rev.toFixed(2),
      cogs: cost.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      marginPercentage: Number(margin.toFixed(2)),
    };
  });
}

export async function getShiftReconciliationReport(
  params?: ReportParams
): Promise<ShiftReconciliationDTO[]> {
  const scope = await resolveReportScope(params?.branchId);
  const { start, end } = resolveDateRangeUTCBounds(params?.dateRange);

  const branchCondition =
    'branchId' in scope
      ? Prisma.sql`AND sh."branchId" = ${scope.branchId}`
      : Prisma.empty;

  const businessTimezone = process.env.BUSINESS_TIMEZONE || 'UTC';

  const result = await prisma.$queryRaw<
    Array<{
      dateStr: string;
      branchId: string;
      branchName: string;
      expectedBalance: Prisma.Decimal;
      actualBalance: Prisma.Decimal;
      discrepancy: Prisma.Decimal;
    }>
  >`
    SELECT
      TO_CHAR(sh."closedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${businessTimezone}, 'YYYY-MM-DD') as "dateStr",
      b."id" as "branchId",
      b."name" as "branchName",
      SUM(sh."expectedBalance") as "expectedBalance",
      SUM(sh."closingBalance") as "actualBalance",
      SUM(sh."discrepancy") as "discrepancy"
    FROM "Shift" sh
    JOIN "Branch" b ON b."id" = sh."branchId"
    WHERE sh."status" = 'CLOSED'
      AND sh."closedAt" >= ${start}
      AND sh."closedAt" <= ${end}
      ${branchCondition}
    GROUP BY "dateStr", b."id", b."name"
    ORDER BY "dateStr" ASC, "branchName" ASC
  `;

  return result.map((r) => ({
    date: r.dateStr,
    branchId: r.branchId,
    branchName: r.branchName,
    expectedBalance: (r.expectedBalance || new Prisma.Decimal(0)).toFixed(2),
    actualBalance: (r.actualBalance || new Prisma.Decimal(0)).toFixed(2),
    discrepancy: (r.discrepancy || new Prisma.Decimal(0)).toFixed(2),
  }));
}
