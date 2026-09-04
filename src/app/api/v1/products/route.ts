import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/handler';
import prisma from '@/lib/prisma';
import { requireAuth, requirePermission } from '@/lib/auth/guard';
import { toSafeProductDTO, ProductWithRelations } from '@/lib/products/dtos';

const querySchema = z.object({
  query: z.string().optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAuth();
  await requirePermission('inventory:read');

  const url = new URL(req.url);
  const parsed = querySchema.parse({
    query: url.searchParams.get('query') || undefined,
    page: url.searchParams.get('page') || undefined,
    limit: url.searchParams.get('limit') || undefined,
    categoryId: url.searchParams.get('categoryId') || undefined,
  });

  const { query, page, limit, categoryId } = parsed;
  const skip = (page - 1) * limit;

  const where = {
    ...(categoryId ? { categoryId } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { sku: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        category: true,
        brand: true,
      },
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    }),
  ]);

  return NextResponse.json({
    data: {
      products: products.map((p) => toSafeProductDTO(p as ProductWithRelations)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});
