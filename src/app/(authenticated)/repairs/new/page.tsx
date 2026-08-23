import { requirePermission } from '@/lib/auth/guard';
import { NewRepairForm } from './new-repair-form';
import { searchCustomers } from '@/lib/customers/actions';

export default async function NewRepairPage() {
  await requirePermission('repairs:create');

  // Load first page of active customers for MVP dropdown
  const { data } = await searchCustomers({ page: 1, activeOnly: true });
  const customers = data?.customers || [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Repair</h2>
        <p className="text-muted-foreground">
          Initialize a new repair ticket for a customer&apos;s device.
        </p>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <NewRepairForm customers={customers} />
      </div>
    </div>
  );
}
