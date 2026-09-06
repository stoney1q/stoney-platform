import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { returnSaleItemSchema } from '@/lib/sales/validation';
import { returnSaleItem } from '@/lib/sales/actions';
import { requireAuth, requirePermission } from '@/lib/auth/guard';

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await requireAuth();
  if (
    session.role.name !== 'Super Admin' &&
    !session.permissions.includes('sales:update')
  ) {
    await requirePermission('sales:update');
  }

  const body = await req.json();

  // Validate request
  const data = returnSaleItemSchema.parse(body);

  // Convert to FormData to reuse the Server Action
  const formData = new FormData();
  formData.append('saleId', data.saleId);
  formData.append('saleItemId', data.saleItemId);
  formData.append('quantity', data.quantity.toString());
  formData.append('refundAmount', data.refundAmount.toString());
  formData.append('refundMethod', data.refundMethod);

  await returnSaleItem(formData);

  return NextResponse.json({ success: true });
});
