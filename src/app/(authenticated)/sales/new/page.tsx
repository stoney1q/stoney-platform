import { requirePermission } from '@/lib/auth/guard';
import { NewSaleForm } from './new-sale-form';
import { searchCustomers } from '@/lib/customers/actions';

export default async function NewSalePage() {
  await requirePermission('sales:create');

  // Load first page of active customers for MVP dropdown
  const { data } = await searchCustomers({ page: 1, activeOnly: true });
  const customers = data?.customers || [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Sale</h2>
        <p className="text-muted-foreground">
          Initialize a new sale by selecting a customer.
        </p>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <NewSaleForm customers={customers} />
      </div>
    </div>
  );
}
