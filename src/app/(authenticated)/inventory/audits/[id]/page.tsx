import { requirePermission } from '@/lib/auth/guard';
import { getAuditById } from '@/lib/inventory/audit-actions';
import { notFound, redirect } from 'next/navigation';
import { ActiveAuditInterface } from './active-audit';
import prisma from '@/lib/prisma';

export default async function ActiveAuditPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission('inventory:read');
  const audit = await getAuditById(params.id);

  if (!audit) notFound();

  // If the audit is no longer in progress, redirect to review
  if (audit.status !== 'IN_PROGRESS') {
    redirect(`/inventory/audits/${audit.id}/review`);
  }

  // Fetch products for this branch to allow scanning/searching
  // In a real app with 10k products, we'd use a server-side search API endpoint
  // For MVP, we load active catalog products.
  const products = await prisma.product.findMany({
    select: { id: true, sku: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {audit.name || `Audit #${audit.sequence}`}
        </h2>
        <p className="text-muted-foreground">Branch: {audit.branch.name}</p>
      </div>

      <ActiveAuditInterface audit={audit} catalog={products} />
    </div>
  );
}
