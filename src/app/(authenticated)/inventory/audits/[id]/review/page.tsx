import { requirePermission } from '@/lib/auth/guard';
import { getAuditById } from '@/lib/inventory/audit-actions';
import { notFound, redirect } from 'next/navigation';
import { ReviewAuditInterface } from './review-audit';

export default async function ReviewAuditPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission('inventory:read');
  const audit = await getAuditById(params.id);

  if (!audit) notFound();

  // If in progress, redirect to count
  if (audit.status === 'IN_PROGRESS') {
    redirect(`/inventory/audits/${audit.id}`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Review Audit: {audit.name || `#${audit.sequence}`}
        </h2>
        <p className="text-muted-foreground">
          Branch: {audit.branch.name} • Status: {audit.status}
        </p>
      </div>

      <ReviewAuditInterface audit={audit} />
    </div>
  );
}
