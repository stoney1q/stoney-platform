import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/handler';
import prisma from '@/lib/prisma';
import { requireAuth, requirePermission, requireBranchAccess } from '@/lib/auth/guard';
import { toSafeBranchStockDTO, BranchStockWithProduct } from '@/lib/inventory/dtos';

const querySchema = z.object({
  query: z.string().optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireAuth();
  await requirePermission('inventory:read');

  const url = new URL(req.url);
  const parsed = querySchema.parse({
    query: url.searchParams.get('query') || undefined,
    page: url.searchParams.get('page') || undefined,
    limit: url.searchParams.get('limit') || undefined,
    branchId: url.searchParams.get('branchId') || undefined,
  });

  const hasGlobal = user.role.name === 'Super Admin' || user.permissions.includes('admin:global');

  // If client requested a specific branchId, verify they have access to it
  if (parsed.branchId) {
    await requireBranchAccess(parsed.branchId);
  }

  // Derive branchId from trusted auth context if not global, or fallback to user's branch
  const branchId = hasGlobal && parsed.branchId ? parsed.branchId : user.branchId;

  if (!branchId) {
    return NextResponse.json({ error: 'User is not assigned to a branch' }, { status: 400 });
  }

  await requireBranchAccess(branchId);

  const { query, page, limit } = parsed;
  const skip = (page - 1) * limit;

  const where = {
    branchId,
    ...(query
      ? {
          product: {
            OR: [
              { name: { contains: query, mode: 'insensitive' as const } },
              { sku: { contains: query, mode: 'insensitive' as const } },
            ],
          },
        }
      : {}),
  };

  const [total, stock] = await Promise.all([
    prisma.branchStock.count({ where }),
    prisma.branchStock.findMany({
      where,
      include: {
        product: true,
      },
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  return NextResponse.json({
    data: {
      stock: stock.map((s) => toSafeBranchStockDTO(s as BranchStockWithProduct)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});
