import { requirePermission } from '@/lib/auth/guard';
import { getCustomer } from '@/lib/customers/actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeactivateCustomerButton } from './deactivate-button';

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission('customers:read');

  const result = await getCustomer(params.id);
  if (!result.success || !result.data) {
    notFound();
  }

  const customer = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {customer.firstName} {customer.lastName}
          </h2>
          <p className="text-muted-foreground">
            Customer No: CUS-{customer.sequence.toString().padStart(6, '0')}
          </p>
        </div>
        <div className="flex space-x-2">
          <Link href={`/customers/${customer.id}/edit`}>
            <Button variant="outline">Edit Profile</Button>
          </Link>
          {customer.isActive && (
            <DeactivateCustomerButton customerId={customer.id} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="bg-card col-span-1 space-y-4 rounded-lg border p-6">
          <h3 className="border-b pb-2 text-lg font-semibold">Contact Info</h3>

          <div>
            <p className="text-muted-foreground text-sm">Status</p>
            {customer.isActive ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                Active
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-800">
                Inactive
              </span>
            )}
          </div>

          <div>
            <p className="text-muted-foreground text-sm">Email</p>
            <p className="font-medium">{customer.email || 'N/A'}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-sm">Phone</p>
            <p className="font-medium">{customer.phone || 'N/A'}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-sm">Alternate Phone</p>
            <p className="font-medium">{customer.alternatePhone || 'N/A'}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-sm">Address</p>
            <p className="font-medium">{customer.address || 'N/A'}</p>
          </div>

          <div className="border-t border-dashed pt-4">
            <p className="text-muted-foreground text-sm">Registered By</p>
            <p className="text-sm font-medium">
              {customer.createdBy?.firstName} {customer.createdBy?.lastName}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {customer.createdAt.toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="bg-card col-span-1 space-y-6 rounded-lg border p-6 md:col-span-2">
          <div className="border-b pb-2">
            <h3 className="text-lg font-semibold">Sales History</h3>
          </div>
          <p className="text-muted-foreground text-sm italic">
            Sales module is not yet implemented. Future sales orders will appear
            here.
          </p>

          <div className="mt-8 border-b pb-2">
            <h3 className="text-lg font-semibold">Repair Tickets</h3>
          </div>
          <p className="text-muted-foreground text-sm italic">
            Repairs module is not yet implemented. Future repair tickets will
            appear here.
          </p>

          <div className="mt-8 border-b pb-2">
            <h3 className="text-lg font-semibold">Quotations</h3>
          </div>
          <p className="text-muted-foreground text-sm italic">
            Quotations module is not yet implemented. Future quotes will appear
            here.
          </p>
        </div>
      </div>
    </div>
  );
}
