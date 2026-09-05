import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/handler';
import { requireAuth, requireBranchAccess, AuthError } from '@/lib/auth/guard';
import { prisma } from '@/lib/prisma';
import { addSaleItem } from '@/lib/sales/actions';
import { toSafeSaleDTO, SaleWithItems } from '@/lib/sales/dtos';
import { SaleStatus } from '@/generated/prisma/client';

const addItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  discount: z
    .number()
    .min(0, 'Discount must be non-negative')
    .optional()
    .default(0),
});

export const POST = apiHandler(async (req: NextRequest, context: unknown) => {
  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });
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
      { error: 'Can only add items to a pending sale' },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = addItemSchema.parse(body);

  const product = await prisma.product.findUnique({
    where: { id: parsed.productId },
  });

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const formData = new FormData();
  formData.append('saleId', id);
  formData.append('productId', parsed.productId);
  formData.append('quantity', String(parsed.quantity));
  if (parsed.discount !== undefined) {
    formData.append('discount', String(parsed.discount));
  }

  try {
    await addSaleItem(formData);
  } catch (err: unknown) {
    if (err instanceof AuthError) throw err;
    const message = err instanceof Error ? err.message : 'Failed to add item';
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
