import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/handler';
import { requireAuth, requirePermission } from '@/lib/auth/guard';
import { searchRepairs, createRepair } from '@/lib/repairs/actions';
import { toSafeRepairDTO, RepairWithRelations } from '@/lib/repairs/dtos';
import { RepairStatus } from '@/generated/prisma/client';

const querySchema = z.object({
  query: z.string().optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(RepairStatus).optional(),
  branchId: z.string().optional(),
});

const createBodySchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  deviceId: z.string().min(1, 'Device ID is required'),
  issue: z.string().min(1, 'Issue description is required'),
  notes: z.string().optional(),
  branchId: z.string().optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAuth();
  await requirePermission('repairs:read');

  const url = new URL(req.url);
  const parsed = querySchema.parse({
    query: url.searchParams.get('query') || undefined,
    page: url.searchParams.get('page') || undefined,
    limit: url.searchParams.get('limit') || undefined,
    status: url.searchParams.get('status') || undefined,
    branchId: url.searchParams.get('branchId') || undefined,
  });

  const result = await searchRepairs({
    query: parsed.query,
    page: parsed.page,
    status: parsed.status,
    branchId: parsed.branchId,
  });

  const repairs = result.data.repairs as unknown as RepairWithRelations[];

  return NextResponse.json({
    data: {
      repairs: repairs.map(toSafeRepairDTO),
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
  await requirePermission('repairs:create');

  const body = await req.json();
  const parsed = createBodySchema.parse(body);

  const formData = new FormData();
  formData.append('customerId', parsed.customerId);
  formData.append('deviceId', parsed.deviceId);
  formData.append('issue', parsed.issue);
  if (parsed.notes) {
    formData.append('notes', parsed.notes);
  }
  if (parsed.branchId) {
    formData.append('branchId', parsed.branchId);
  }

  const repair = await createRepair(formData);

  return NextResponse.json(
    {
      data: {
        repair: toSafeRepairDTO(repair as RepairWithRelations),
      },
    },
    { status: 201 }
  );
});
