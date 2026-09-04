import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/handler';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { toSafeBranchDTO } from '@/lib/branches/dtos';

const querySchema = z.object({
  query: z.string().optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireAuth();

  const url = new URL(req.url);
  const parsed = querySchema.parse({
    query: url.searchParams.get('query') || undefined,
    page: url.searchParams.get('page') || undefined,
    limit: url.searchParams.get('limit') || undefined,
  });

  const { query, page, limit } = parsed;
  const skip = (page - 1) * limit;

  // Normal users can only see their own branch unless they have global access
  const hasGlobalAccess = user.role.name === 'Super Admin' || user.permissions.includes('admin:global');

  const where = {
    isActive: true, // Mobile app should only see active branches
    ...(!hasGlobalAccess && user.branchId ? { id: user.branchId } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { code: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, branches] = await Promise.all([
    prisma.branch.count({ where }),
    prisma.branch.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    }),
  ]);

  return NextResponse.json({
    data: {
      branches: branches.map(toSafeBranchDTO),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});
