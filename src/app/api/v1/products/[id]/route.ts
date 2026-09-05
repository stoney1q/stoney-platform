import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import prisma from '@/lib/prisma';
import { requireAuth, requirePermission } from '@/lib/auth/guard';

export const GET = apiHandler(async (req: NextRequest, context: unknown) => {
  const user = await requireAuth();
  await requirePermission('inventory:read');

  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: 'Product ID is required' },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  const requestedBranchId = url.searchParams.get('branchId');

  let targetBranchId = user.branchId;
  if (
    requestedBranchId &&
    (user.role.name === 'Super Admin' ||
      user.permissions.includes('admin:global'))
  ) {
    targetBranchId = requestedBranchId;
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      brand: true,
      branchStocks: {
        where: targetBranchId ? { branchId: targetBranchId } : undefined,
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const branchStock = product.branchStocks[0];
  const stock = branchStock
    ? {
        branchId: branchStock.branchId,
        onHand: branchStock.onHand,
        reserved: branchStock.reserved,
        available: Math.max(0, branchStock.onHand - branchStock.reserved),
      }
    : {
        branchId: targetBranchId,
        onHand: 0,
        reserved: 0,
        available: 0,
      };

  return NextResponse.json({
    data: {
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        type: product.type,
        sellingPrice: product.sellingPrice.toString(),
        category: product.category?.name || null,
        brand: product.brand?.name || null,
        stock,
      },
    },
  });
});
