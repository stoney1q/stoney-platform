import { NextResponse, NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { dispatchTransfer } from '@/lib/inventory/actions';

export const POST = apiHandler(async (req: NextRequest, context: unknown) => {
  const { params } = context as { params: { id: string } };
  const result = await dispatchTransfer(params.id);

  return NextResponse.json(
    {
      data: {
        success: true,
        transfer: result,
      },
    },
    { status: 200 }
  );
});
