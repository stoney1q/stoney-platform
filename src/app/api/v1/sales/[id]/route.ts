import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { getSale } from '@/lib/sales/actions';
import { toSafeSaleDTO, SaleWithRelations } from '@/lib/sales/dtos';

export const GET = apiHandler(async (req: NextRequest, context: unknown) => {
  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });
  }

  const sale = await getSale(id);

  if (!sale) {
    return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      sale: toSafeSaleDTO(sale as SaleWithRelations),
    },
  });
});
