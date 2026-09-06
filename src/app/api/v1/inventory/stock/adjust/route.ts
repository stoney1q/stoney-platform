import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { adjustStock } from '@/lib/inventory/actions';
import { adjustStockSchema } from '@/lib/inventory/validation';
import {
  toSafeBranchStockDTO,
  BranchStockWithProduct,
} from '@/lib/inventory/dtos';

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = adjustStockSchema.parse(body);

  const stock = await adjustStock(
    parsed.branchId,
    parsed.productId,
    parsed.quantity,
    parsed.reason
  );

  return NextResponse.json(
    {
      data: toSafeBranchStockDTO(stock as BranchStockWithProduct),
    },
    { status: 200 }
  );
});
