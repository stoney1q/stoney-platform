import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/handler';
import { requireAuth, requirePermission } from '@/lib/auth/guard';
import { searchQuotations, createQuotation } from '@/lib/quotations/actions';
import { toSafeQuotationDTO, QuotationWithItems } from '@/lib/quotations/dtos';
import { QuotationStatus } from '@/generated/prisma/client';

const querySchema = z.object({
  query: z.string().optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(QuotationStatus).optional(),
  branchId: z.string().optional(),
});

const createBodySchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  branchId: z.string().optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAuth();
  await requirePermission('quotations:read');

  const url = new URL(req.url);
  const parsed = querySchema.parse({
    query: url.searchParams.get('query') || undefined,
    page: url.searchParams.get('page') || undefined,
    limit: url.searchParams.get('limit') || undefined,
    status: url.searchParams.get('status') || undefined,
    branchId: url.searchParams.get('branchId') || undefined,
  });

  const result = await searchQuotations({
    query: parsed.query,
    page: parsed.page,
    status: parsed.status,
    branchId: parsed.branchId,
  });

  const quotations = result.data.quotations as unknown as QuotationWithItems[];

  return NextResponse.json({
    data: {
      quotations: quotations.map(toSafeQuotationDTO),
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
  await requirePermission('quotations:create');

  const body = await req.json();
  const parsed = createBodySchema.parse(body);

  const formData = new FormData();
  formData.append('customerId', parsed.customerId);
  if (parsed.branchId) {
    formData.append('branchId', parsed.branchId);
  }

  const quotation = await createQuotation(formData);

  return NextResponse.json(
    {
      data: {
        quotation: toSafeQuotationDTO(quotation as QuotationWithItems),
      },
    },
    { status: 201 }
  );
});
