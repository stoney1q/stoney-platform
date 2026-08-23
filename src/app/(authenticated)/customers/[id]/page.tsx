import { requirePermission } from '@/lib/auth/guard';
import { getCustomer } from '@/lib/customers/actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeactivateCustomerButton } from './deactivate-button';

import { prisma } from '@/lib/prisma';

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

  // Fetch history for the customer
  const [sales, repairs, quotations, deviceCount] = await Promise.all([
    prisma.sale.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.repair.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { device: true },
    }),
    prisma.quotation.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.device.count({
      where: { customerId: customer.id },
    }),
  ]);

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
          <Link href={`/customers/${customer.id}/devices`}>
            <Button variant="outline">Manage Devices ({deviceCount})</Button>
          </Link>
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
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-lg font-semibold">Recent Sales</h3>
            <Link href={`/sales/new?customerId=${customer.id}`}>
              <Button variant="ghost" size="sm">
                New Sale
              </Button>
            </Link>
          </div>
          {sales.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">
              No sales found.
            </p>
          ) : (
            <div className="space-y-2">
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <span>{new Date(sale.createdAt).toLocaleDateString()}</span>
                  <span>{sale.status}</span>
                  <span className="font-medium">${sale.total.toString()}</span>
                  <Link
                    href={`/sales/${sale.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-b pb-2">
            <h3 className="text-lg font-semibold">Recent Repair Tickets</h3>
            <Link href={`/repairs/new?customerId=${customer.id}`}>
              <Button variant="ghost" size="sm">
                New Repair
              </Button>
            </Link>
          </div>
          {repairs.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">
              No repair tickets found.
            </p>
          ) : (
            <div className="space-y-2">
              {repairs.map((repair) => (
                <div
                  key={repair.id}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <span>{new Date(repair.createdAt).toLocaleDateString()}</span>
                  <span>
                    {repair.device.make} {repair.device.model}
                  </span>
                  <span>{repair.status}</span>
                  <Link
                    href={`/repairs/${repair.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-b pb-2">
            <h3 className="text-lg font-semibold">Recent Quotations</h3>
            <Link href={`/quotations/new?customerId=${customer.id}`}>
              <Button variant="ghost" size="sm">
                New Quote
              </Button>
            </Link>
          </div>
          {quotations.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">
              No quotations found.
            </p>
          ) : (
            <div className="space-y-2">
              {quotations.map((quote) => (
                <div
                  key={quote.id}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <span>{new Date(quote.createdAt).toLocaleDateString()}</span>
                  <span>{quote.status}</span>
                  <span className="font-medium">${quote.total.toString()}</span>
                  <Link
                    href={`/quotations/${quote.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
