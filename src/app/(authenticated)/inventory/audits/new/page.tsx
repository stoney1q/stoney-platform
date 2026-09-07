import { requirePermission } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { CreateAuditForm } from './create-form';

export default async function NewAuditPage() {
  await requirePermission('inventory:write');

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Stock Audit</h2>
        <p className="text-muted-foreground">
          Start a new physical cycle count.
        </p>
      </div>

      <CreateAuditForm branches={branches} />
    </div>
  );
}
