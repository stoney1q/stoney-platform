import { NextResponse, NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { upsertAuditItem } from '@/lib/inventory/audit-actions';
import { z } from 'zod';

const bodySchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int(),
  mode: z.enum(['set', 'increment']).default('increment'),
});

export const POST = apiHandler(async (req: NextRequest, context: unknown) => {
  const { params } = context as { params: { id: string } };
  const body = await req.json();
  const parsed = bodySchema.parse(body);

  const result = await upsertAuditItem(
    params.id,
    parsed.productId,
    parsed.quantity,
    parsed.mode
  );

  return NextResponse.json(
    {
      data: {
        success: true,
        item: result,
      },
    },
    { status: 201 }
  );
});
