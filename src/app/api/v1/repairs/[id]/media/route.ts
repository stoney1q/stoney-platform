import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { getRepairMedia } from '@/lib/media/actions';
import { requireAuth, requirePermission } from '@/lib/auth/guard';

export const GET = apiHandler(async (req: NextRequest, context: unknown) => {
  await requireAuth();
  await requirePermission('repairs:read');

  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing repair ID' }, { status: 400 });
  }

  try {
    const media = await getRepairMedia(id);

    return NextResponse.json({
      data: { media },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Repair not found.') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
});
