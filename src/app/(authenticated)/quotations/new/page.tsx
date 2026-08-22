import { requirePermission } from '@/lib/auth/guard';
import { NewQuotationForm } from './new-quotation-form';
import { searchCustomers } from '@/lib/customers/actions';

export default async function NewQuotationPage() {
  await requirePermission('quotations:create');

  // Load first page of active customers for MVP dropdown
  const { data } = await searchCustomers({ page: 1, activeOnly: true });
  const customers = data?.customers || [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Quotation</h2>
        <p className="text-muted-foreground">
          Initialize a new quotation by selecting a customer.
        </p>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <NewQuotationForm customers={customers} />
      </div>
    </div>
  );
}
