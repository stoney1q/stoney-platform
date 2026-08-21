import { requirePermission } from '@/lib/auth/guard';
import { CustomerForm } from '../customer-form';

export default async function NewCustomerPage() {
  await requirePermission('customers:create');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Add Customer</h2>
        <p className="text-muted-foreground">
          Register a new customer for sales and repairs.
        </p>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <CustomerForm />
      </div>
    </div>
  );
}
