import { requirePermission } from '@/lib/auth/guard';
import { searchRepairs } from '@/lib/repairs/actions';
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
import { RepairStatus } from '@/generated/prisma/client';

export default async function RepairsPage({
  searchParams,
}: {
  searchParams: { query?: string; page?: string; status?: string };
}) {
  await requirePermission('repairs:read');

  const query = searchParams.query || '';
  const page = parseInt(searchParams.page || '1', 10);
  const status = searchParams.status
    ? (searchParams.status as RepairStatus)
    : undefined;

  const result = await searchRepairs({ query, page, status });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Repairs</h2>
          <p className="text-muted-foreground">
            Manage your repair tickets, assign technicians, and track progress.
          </p>
        </div>
        <Link href="/repairs/new">
          <Button>New Repair</Button>
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
            className="border-input focus-visible:ring-ring flex h-9 w-40 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="RECEIVED">Received</option>
            <option value="DIAGNOSTIC">Diagnostic</option>
            <option value="QUOTED">Quoted</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="DELIVERED">Delivered</option>
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
              <TableHead>Repair ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Technician</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!result.success || result.data?.repairs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground text-center"
                >
                  No repairs found.
                </TableCell>
              </TableRow>
            ) : (
              result.data?.repairs.map((repair) => (
                <TableRow key={repair.id}>
                  <TableCell className="font-medium">
                    {repair.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>{repair.createdAt.toLocaleDateString()}</TableCell>
                  <TableCell>
                    {repair.customer.firstName} {repair.customer.lastName}
                  </TableCell>
                  <TableCell>
                    {repair.device.make} {repair.device.model}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
                      {repair.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {repair.technician
                      ? `${repair.technician.firstName} ${repair.technician.lastName}`
                      : 'Unassigned'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/repairs/${repair.id}`}>
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
              href={`/repairs?query=${encodeURIComponent(query)}&page=${page - 1}`}
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
              href={`/repairs?query=${encodeURIComponent(query)}&page=${page + 1}`}
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
