import { ReactNode } from 'react';
import { requirePermission } from '@/lib/auth/guard';

export default async function ReportsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePermission('reports:read');

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Reporting & Analytics
        </h2>
      </div>
      {children}
    </div>
  );
}
