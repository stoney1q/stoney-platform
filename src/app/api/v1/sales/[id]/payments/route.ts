import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/handler';
import {
  requireAuth,
  requirePermission,
  requireBranchAccess,
  AuthError,
} from '@/lib/auth/guard';
import { prisma } from '@/lib/prisma';
import { applyPayment } from '@/lib/sales/actions';
import { toSafeSaleDTO, SaleWithItems } from '@/lib/sales/dtos';
import { PaymentMethod, SaleStatus } from '@/generated/prisma/client';

const paymentBodySchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero'),
  method: z.nativeEnum(PaymentMethod, {
    message: 'Invalid payment method',
  }),
  reference: z.string().optional(),
});

export const POST = apiHandler(async (req: NextRequest, context: unknown) => {
  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });
  }

  await requireAuth();
  await requirePermission('payments:create');

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
      { error: 'Can only apply payments to a pending sale' },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = paymentBodySchema.parse(body);

  const formData = new FormData();
  formData.append('saleId', id);
  formData.append('amount', String(parsed.amount));
  formData.append('method', parsed.method);
  if (parsed.reference) {
    formData.append('reference', parsed.reference);
  }

  try {
    await applyPayment(formData);
  } catch (err: unknown) {
    if (err instanceof AuthError) throw err;
    const message =
      err instanceof Error ? err.message : 'Payment processing failed';
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
