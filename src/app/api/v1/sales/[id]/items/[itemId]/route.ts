import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { requireAuth, requireBranchAccess, AuthError } from '@/lib/auth/guard';
import { prisma } from '@/lib/prisma';
import { removeSaleItem } from '@/lib/sales/actions';
import { toSafeSaleDTO, SaleWithItems } from '@/lib/sales/dtos';
import { SaleStatus } from '@/generated/prisma/client';

export const DELETE = apiHandler(async (req: NextRequest, context: unknown) => {
  const { params } = context as {
    params: Promise<{ id: string; itemId: string }>;
  };
  const { id, itemId } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });
  }

  if (!itemId) {
    return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
  }

  const session = await requireAuth();
  if (
    session.role.name !== 'Super Admin' &&
    !session.permissions.includes('sales:create') &&
    !session.permissions.includes('sales:update')
  ) {
    throw new AuthError(
      'Access denied. Permission "sales:create" or "sales:update" is required.',
      403,
      'FORBIDDEN'
    );
  }

  const sale = await prisma.sale.findUnique({
    where: { id },
    select: { id: true, branchId: true, status: true },
  });

  if (!sale) {
    return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
  }

  await requireBranchAccess(sale.branchId);

  if (sale.status !== SaleStatus.PENDING) {
    return NextResponse.json(
      { error: 'Can only remove items from a pending sale' },
      { status: 400 }
    );
  }

  const item = await prisma.saleItem.findUnique({
    where: { id: itemId },
  });

  if (!item || item.saleId !== id) {
    return NextResponse.json({ error: 'Sale item not found' }, { status: 404 });
  }

  const formData = new FormData();
  formData.append('saleId', id);
  formData.append('saleItemId', itemId);

  try {
    await removeSaleItem(formData);
  } catch (err: unknown) {
    if (err instanceof AuthError) throw err;
    const message =
      err instanceof Error ? err.message : 'Failed to remove item';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const updatedSale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      items: true,
      payments: true,
    },
  });

  return NextResponse.json({
    data: {
      sale: toSafeSaleDTO(updatedSale as SaleWithItems),
    },
  });
});
