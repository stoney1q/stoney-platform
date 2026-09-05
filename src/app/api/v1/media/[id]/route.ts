import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { deleteMedia } from '@/lib/media/actions';
import { requireAuth } from '@/lib/auth/guard';

export const DELETE = apiHandler(async (req: NextRequest, context: unknown) => {
  await requireAuth();

  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing media ID' }, { status: 400 });
  }

  try {
    await deleteMedia(id);

    return NextResponse.json({ data: { success: true } }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Media asset not found.') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
});
