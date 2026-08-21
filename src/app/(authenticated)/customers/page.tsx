import { requirePermission } from '@/lib/auth/guard';
import { searchCustomers } from '@/lib/customers/actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { query?: string; page?: string; activeOnly?: string };
}) {
  await requirePermission('customers:read');

  const query = searchParams.query || '';
  const page = parseInt(searchParams.page || '1', 10);
  const activeOnly = searchParams.activeOnly !== 'false';

  const result = await searchCustomers({ query, page, activeOnly });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
          <p className="text-muted-foreground">
            Manage your customer database and view history.
          </p>
        </div>
        <Link href="/customers/new">
          <Button>Add Customer</Button>
        </Link>
      </div>

      <div className="flex items-center space-x-2">
        <form
          method="GET"
          className="flex w-full max-w-sm items-center space-x-2"
        >
          <input
            type="text"
            name="query"
            defaultValue={query}
            placeholder="Search by name, email, phone, or CUS-XXX..."
            className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer No.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!result.success || result.data?.customers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground text-center"
                >
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              result.data?.customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    CUS-{customer.sequence.toString().padStart(6, '0')}
                  </TableCell>
                  <TableCell>
                    {customer.firstName} {customer.lastName}
                  </TableCell>
                  <TableCell>{customer.phone || '-'}</TableCell>
                  <TableCell>{customer.email || '-'}</TableCell>
                  <TableCell>
                    {customer.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-800">
                        Inactive
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/customers/${customer.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {result.success && result.data && result.data.totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          {page > 1 && (
            <Link
              href={`/customers?query=${encodeURIComponent(query)}&page=${page - 1}`}
            >
              <Button variant="outline" size="sm">
                Previous
              </Button>
            </Link>
          )}
          <span className="py-2 text-sm">
            Page {page} of {result.data.totalPages}
          </span>
          {page < result.data.totalPages && (
            <Link
              href={`/customers?query=${encodeURIComponent(query)}&page=${page + 1}`}
            >
              <Button variant="outline" size="sm">
                Next
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
