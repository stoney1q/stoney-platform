import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { requireAuth, requireBranchAccess, AuthError } from '@/lib/auth/guard';
import { prisma } from '@/lib/prisma';
import { cancelSale } from '@/lib/sales/actions';
import { SaleStatus } from '@/generated/prisma/client';

export const POST = apiHandler(async (req: NextRequest, context: unknown) => {
  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });
  }

  const session = await requireAuth();
  if (
    session.role.name !== 'Super Admin' &&
    !session.permissions.includes('sales:cancel') &&
    !session.permissions.includes('sales:delete')
  ) {
    throw new AuthError(
      'Access denied. Permission "sales:cancel" or "sales:delete" is required.',
      403,
      'FORBIDDEN'
    );
  }

  const sale = await prisma.sale.findUnique({
    where: { id },
    select: {
      id: true,
      branchId: true,
      status: true,
      payments: { select: { id: true } },
    },
  });

  if (!sale) {
    return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
  }

  await requireBranchAccess(sale.branchId);

  if (sale.status !== SaleStatus.PENDING) {
    return NextResponse.json(
      { error: 'Can only cancel a pending sale' },
      { status: 400 }
    );
  }

  if (sale.payments.length > 0) {
    return NextResponse.json(
      { error: 'Cannot cancel a sale with existing payments' },
      { status: 400 }
    );
  }

  const formData = new FormData();
  formData.append('saleId', id);

  try {
    const cancelled = await cancelSale(formData);
    return NextResponse.json({
      data: {
        success: true,
        saleId: cancelled.id,
        status: cancelled.status,
        cancelledAt: cancelled.cancelledAt,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) throw err;
    const message =
      err instanceof Error ? err.message : 'Failed to cancel sale';
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
