import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/handler';
import prisma from '@/lib/prisma';
import { requireAuth, requirePermission, requireBranchAccess } from '@/lib/auth/guard';
import { toSafeStockMovementDTO, StockMovementWithProduct } from '@/lib/inventory/dtos';
import { MovementType } from '@/generated/prisma/client';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().optional(),
  type: z.nativeEnum(MovementType).optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireAuth();
  await requirePermission('inventory:read');

  const url = new URL(req.url);
  const parsed = querySchema.parse({
    page: url.searchParams.get('page') || undefined,
    limit: url.searchParams.get('limit') || undefined,
    branchId: url.searchParams.get('branchId') || undefined,
    type: url.searchParams.get('type') || undefined,
  });

  const hasGlobal = user.role.name === 'Super Admin' || user.permissions.includes('admin:global');

  if (parsed.branchId) {
    await requireBranchAccess(parsed.branchId);
  }

  const branchId = hasGlobal && parsed.branchId ? parsed.branchId : user.branchId;

  if (!branchId) {
    return NextResponse.json({ error: 'User is not assigned to a branch' }, { status: 400 });
  }

  await requireBranchAccess(branchId);

  const { page, limit, type } = parsed;
  const skip = (page - 1) * limit;

  const where = {
    branchId,
    ...(type ? { type } : {}),
  };

  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        product: true,
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return NextResponse.json({
    data: {
      movements: movements.map((m) => toSafeStockMovementDTO(m as StockMovementWithProduct)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});
