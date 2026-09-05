import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/handler';
import prisma from '@/lib/prisma';
import { requireAuth, requirePermission, requireBranchAccess, requireGlobalAccess } from '@/lib/auth/guard';
import { toSafeBranchStockDTO, BranchStockWithProduct } from '@/lib/inventory/dtos';
import { Prisma } from '@/generated/prisma/client';

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

  const targetBranchId = parsed.branchId || user.branchId;

  if (!targetBranchId) {
    return NextResponse.json({ error: 'User is not assigned to a branch' }, { status: 400 });
  }

  if (targetBranchId === 'all') {
    await requireGlobalAccess(user);
  } else {
    await requireBranchAccess(targetBranchId);
  }

  const { query, page, limit } = parsed;
  const skip = (page - 1) * limit;

  const where: Prisma.BranchStockWhereInput = {
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

  if (targetBranchId !== 'all') {
    where.branchId = targetBranchId;
  }

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
