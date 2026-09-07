import { NextResponse, NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { receivePurchaseOrder } from '@/lib/purchases/actions';
import { z } from 'zod';

const itemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(0),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1),
});

export const POST = apiHandler(async (req: NextRequest, context: unknown) => {
  const { params } = context as { params: { id: string } };
  const body = await req.json();
  const parsed = bodySchema.parse(body);

  const result = await receivePurchaseOrder(params.id, parsed);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    {
      data: {
        success: true,
        order: result.data,
      },
    },
    { status: 200 }
  );
});
