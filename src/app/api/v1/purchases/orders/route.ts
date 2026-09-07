import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { requireAuth, requirePermission } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { PurchaseOrderStatus } from '@/generated/prisma/client';

export const GET = apiHandler(async () => {
  const session = await requireAuth();
  await requirePermission('purchases:read');

  // If not global admin, filter by user branch
  const isAdmin =
    session.permissions.includes('admin:global') ||
    session.role.name === 'Super Admin';
  const branchId = isAdmin ? undefined : session.branchId;

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      status: {
        in: [
          PurchaseOrderStatus.ORDERED,
          PurchaseOrderStatus.PARTIALLY_RECEIVED,
        ],
      },
    },
    include: {
      supplier: true,
      items: {
        include: {
          product: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    data: {
      orders,
    },
  });
});
