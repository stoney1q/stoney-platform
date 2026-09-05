import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/handler';
import { generateUploadUrl } from '@/lib/media/actions';
import { requireAuth, requirePermission } from '@/lib/auth/guard';

const uploadUrlSchema = z.object({
  entityType: z.enum(['product', 'repair']),
  entityId: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  fileName: z.string().min(1),
});

const BAD_REQUEST_MESSAGES = [
  'File size exceeds the 5MB limit.',
  'Invalid file type.',
  'Product not found.',
  'Repair not found.',
  'Invalid entity type.',
];

export const POST = apiHandler(async (req: NextRequest) => {
  await requireAuth();

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parsed = uploadUrlSchema.parse(body);

  if (parsed.entityType === 'product') {
    await requirePermission('products:write');
  } else if (parsed.entityType === 'repair') {
    await requirePermission('repairs:write');
  }

  try {
    const result = await generateUploadUrl(parsed);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      BAD_REQUEST_MESSAGES.includes(error.message)
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
});
