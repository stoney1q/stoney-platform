import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { receiveStock } from '@/lib/inventory/actions';
import { receiveStockSchema } from '@/lib/inventory/validation';
import {
  toSafeBranchStockDTO,
  BranchStockWithProduct,
} from '@/lib/inventory/dtos';

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = receiveStockSchema.parse(body);

  const reason = parsed.supplierId
    ? 'Receipt from Supplier'
    : 'Direct stock receipt';

  const stock = await receiveStock(
    parsed.branchId,
    parsed.productId,
    parsed.quantity,
    reason,
    parsed.supplierId
  );

  return NextResponse.json(
    {
      data: toSafeBranchStockDTO(stock as BranchStockWithProduct),
    },
    { status: 200 }
  );
});
