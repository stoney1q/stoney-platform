import { requirePermission } from '@/lib/auth/guard';
import { SupplierForm } from '../supplier-form';

export default async function NewSupplierPage() {
  await requirePermission('suppliers:create');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Add Supplier</h2>
        <p className="text-muted-foreground">
          Register a new vendor for purchasing and inventory.
        </p>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <SupplierForm />
      </div>
    </div>
  );
}
