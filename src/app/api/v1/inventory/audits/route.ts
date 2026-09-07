import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { getAudits } from '@/lib/inventory/audit-actions';

export const GET = apiHandler(async () => {
  const audits = await getAudits();

  return NextResponse.json({
    data: {
      audits,
    },
  });
});
