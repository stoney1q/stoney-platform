import { NextResponse, NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { getAuditById } from '@/lib/inventory/audit-actions';

export const GET = apiHandler(async (req: NextRequest, context: unknown) => {
  const { params } = context as { params: { id: string } };
  const audit = await getAuditById(params.id);
  if (!audit) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      audit,
    },
  });
});
