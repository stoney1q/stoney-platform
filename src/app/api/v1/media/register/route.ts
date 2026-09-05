import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/handler';
import { registerMedia } from '@/lib/media/actions';
import { requireAuth } from '@/lib/auth/guard';

const registerSchema = z.object({
  assetId: z.string().min(1),
});

const BAD_REQUEST_MESSAGES = [
  'Media asset not found.',
  'Media asset is not in PENDING state.',
  'File not found in storage. Did the upload complete?',
  'File mime type mismatch in storage.',
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

  const parsed = registerSchema.parse(body);

  try {
    await registerMedia(parsed.assetId);

    return NextResponse.json({ data: { success: true } }, { status: 200 });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      BAD_REQUEST_MESSAGES.includes(error.message)
    ) {
      // Map 'not found' messages to 404
      const status = error.message === 'Media asset not found.' ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
});
