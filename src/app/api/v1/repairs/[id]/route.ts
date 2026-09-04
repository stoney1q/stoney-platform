import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/handler';
import { requireAuth, requirePermission } from '@/lib/auth/guard';
import { getRepairById, updateRepairStatus } from '@/lib/repairs/actions';
import { toSafeRepairDTO, RepairWithRelations } from '@/lib/repairs/dtos';
import { RepairStatus } from '@/generated/prisma/client';

const paramsSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

const updateBodySchema = z.object({
  status: z.nativeEnum(RepairStatus),
  notes: z.string().optional(),
  version: z.number().int().min(1),
});

export const GET = apiHandler(async (req: NextRequest, context: unknown) => {
  await requireAuth();
  await requirePermission('repairs:read');

  const { params } = context as { params: Promise<{ id: string }> };
  const rawParams = await params;
  const { id } = paramsSchema.parse(rawParams);

  const repair = await getRepairById(id);

  if (!repair) {
    return NextResponse.json({ error: 'Repair not found' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      repair: toSafeRepairDTO(repair as RepairWithRelations),
    },
  });
});

export const PUT = apiHandler(async (req: NextRequest, context: unknown) => {
  await requireAuth();
  await requirePermission('repairs:update');

  const { params } = context as { params: Promise<{ id: string }> };
  const rawParams = await params;
  const { id } = paramsSchema.parse(rawParams);

  const body = await req.json();
  const parsed = updateBodySchema.parse(body);

  const formData = new FormData();
  formData.append('repairId', id);
  formData.append('status', parsed.status);
  formData.append('version', String(parsed.version));
  if (parsed.notes) {
    formData.append('notes', parsed.notes);
  }

  const updated = await updateRepairStatus(formData);

  return NextResponse.json({
    data: {
      repair: toSafeRepairDTO(updated as RepairWithRelations),
    },
  });
});
