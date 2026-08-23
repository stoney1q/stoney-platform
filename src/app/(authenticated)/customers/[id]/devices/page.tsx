import { requirePermission } from '@/lib/auth/guard';
import { getCustomer } from '@/lib/customers/actions';
import { getCustomerDevices } from '@/lib/repairs/actions';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DeviceListClient } from './device-list-client';

export default async function CustomerDevicesPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission('customers:read');

  const [customerResult, devices] = await Promise.all([
    getCustomer(params.id),
    getCustomerDevices(params.id),
  ]);

  if (!customerResult.success || !customerResult.data) {
    notFound();
  }

  const customer = customerResult.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Devices for {customer.firstName} {customer.lastName}
          </h2>
          <p className="text-muted-foreground">
            Customer No: CUS-{customer.sequence.toString().padStart(6, '0')}
          </p>
        </div>
        <div className="flex space-x-2">
          <Link href={`/customers/${customer.id}`}>
            <Button variant="outline">Back to Customer</Button>
          </Link>
        </div>
      </div>

      <DeviceListClient customerId={customer.id} initialDevices={devices} />
    </div>
  );
}
