import { requirePermission } from '@/lib/auth/guard';
import { getCustomer } from '@/lib/customers/actions';
import { CustomerForm } from '../../customer-form';
import { notFound } from 'next/navigation';

export default async function EditCustomerPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission('customers:update');

  const result = await getCustomer(params.id);

  if (!result.success || !result.data) {
    notFound();
  }

  const customer = result.data;

  const initialData = {
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email || '',
    phone: customer.phone || '',
    alternatePhone: customer.alternatePhone || '',
    address: customer.address || '',
    isActive: customer.isActive,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Edit Customer</h2>
        <p className="text-muted-foreground">
          Update profile details for {customer.firstName} {customer.lastName}.
        </p>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <CustomerForm initialData={initialData} customerId={customer.id} />
      </div>
    </div>
  );
}
