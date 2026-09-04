import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/handler';
import { requireAuth, requirePermission, requireBranchAccess } from '@/lib/auth/guard';
import { searchSales, createSale } from '@/lib/sales/actions';
import { toSafeSaleDTO, SaleWithItems } from '@/lib/sales/dtos';
import { SaleStatus } from '@/generated/prisma/client';

const querySchema = z.object({
  query: z.string().optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(SaleStatus).optional(),
  branchId: z.string().optional(),
});

const createBodySchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
});

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAuth();
  await requirePermission('sales:read');

  const url = new URL(req.url);
  const parsed = querySchema.parse({
    query: url.searchParams.get('query') || undefined,
    page: url.searchParams.get('page') || undefined,
    limit: url.searchParams.get('limit') || undefined,
    status: url.searchParams.get('status') || undefined,
    branchId: url.searchParams.get('branchId') || undefined,
  });

  if (parsed.branchId) {
    await requireBranchAccess(parsed.branchId);
  }

  const result = await searchSales({
    query: parsed.query,
    page: parsed.page,
    status: parsed.status,
  });

  const sales = result.data.sales as unknown as SaleWithItems[];

  return NextResponse.json({
    data: {
      sales: sales.map(toSafeSaleDTO),
      pagination: {
        total: result.data.total,
        page: result.data.currentPage,
        limit: parsed.limit,
        totalPages: result.data.totalPages,
      },
    },
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  await requireAuth();
  await requirePermission('sales:create');

  const body = await req.json();
  const parsed = createBodySchema.parse(body);

  const formData = new FormData();
  formData.append('customerId', parsed.customerId);

  const sale = await createSale(formData);

  return NextResponse.json(
    {
      data: {
        sale: toSafeSaleDTO(sale as SaleWithItems),
      },
    },
    { status: 201 }
  );
});
