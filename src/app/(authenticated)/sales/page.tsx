import { requirePermission } from '@/lib/auth/guard';
import { searchSales } from '@/lib/sales/actions';
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
import { SaleStatus } from '@/generated/prisma/client';

export default async function SalesPage({
  searchParams,
}: {
  searchParams: { query?: string; page?: string; status?: string };
}) {
  await requirePermission('sales:read');

  const query = searchParams.query || '';
  const page = parseInt(searchParams.page || '1', 10);
  const status = searchParams.status
    ? (searchParams.status as SaleStatus)
    : undefined;

  const result = await searchSales({ query, page, status });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sales</h2>
          <p className="text-muted-foreground">
            Manage your sales orders and point of sale.
          </p>
        </div>
        <Link href="/sales/new">
          <Button>New Sale</Button>
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
            placeholder="Search by ID or customer..."
            className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <select
            name="status"
            defaultValue={status || ''}
            className="border-input focus-visible:ring-ring flex h-9 w-32 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sale ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!result.success || result.data?.sales.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground text-center"
                >
                  No sales found.
                </TableCell>
              </TableRow>
            ) : (
              result.data?.sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">
                    {sale.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>{sale.createdAt.toLocaleDateString()}</TableCell>
                  <TableCell>
                    {sale.customer.firstName} {sale.customer.lastName}
                  </TableCell>
                  <TableCell>
                    {sale.status === 'COMPLETED' && (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                        Completed
                      </span>
                    )}
                    {sale.status === 'PENDING' && (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800">
                        Pending
                      </span>
                    )}
                    {sale.status === 'CANCELLED' && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                        Cancelled
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${sale.total.toString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/sales/${sale.id}`}>
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
              href={`/sales?query=${encodeURIComponent(query)}&page=${page - 1}`}
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
              href={`/sales?query=${encodeURIComponent(query)}&page=${page + 1}`}
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
