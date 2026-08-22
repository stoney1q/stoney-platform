import { requirePermission } from '@/lib/auth/guard';
import { searchQuotations } from '@/lib/quotations/actions';
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
import { QuotationStatus } from '@/generated/prisma/client';

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: { query?: string; page?: string; status?: string };
}) {
  await requirePermission('quotations:read');

  const query = searchParams.query || '';
  const page = parseInt(searchParams.page || '1', 10);
  const status = searchParams.status
    ? (searchParams.status as QuotationStatus)
    : undefined;

  const result = await searchQuotations({ query, page, status });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Quotations</h2>
          <p className="text-muted-foreground">
            Manage customer quotations and estimates.
          </p>
        </div>
        <Link href="/quotations/new">
          <Button>New Quotation</Button>
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
            placeholder="Search by sequence or customer..."
            className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <select
            name="status"
            defaultValue={status || ''}
            className="border-input focus-visible:ring-ring flex h-9 w-32 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
            <option value="CONVERTED">Converted</option>
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
              <TableHead>Quotation #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!result.success || result.data?.quotations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground text-center"
                >
                  No quotations found.
                </TableCell>
              </TableRow>
            ) : (
              result.data?.quotations.map((quotation) => (
                <TableRow key={quotation.id}>
                  <TableCell className="font-medium">
                    QTN-{quotation.sequence.toString().padStart(5, '0')}
                  </TableCell>
                  <TableCell>
                    {quotation.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {quotation.customer.firstName} {quotation.customer.lastName}
                  </TableCell>
                  <TableCell>
                    {quotation.status === 'CONVERTED' && (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                        Converted
                      </span>
                    )}
                    {quotation.status === 'ACCEPTED' && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                        Accepted
                      </span>
                    )}
                    {(quotation.status === 'DRAFT' ||
                      quotation.status === 'SENT') && (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800">
                        {quotation.status === 'DRAFT' ? 'Draft' : 'Sent'}
                      </span>
                    )}
                    {(quotation.status === 'REJECTED' ||
                      quotation.status === 'EXPIRED') && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                        {quotation.status === 'REJECTED'
                          ? 'Rejected'
                          : 'Expired'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${quotation.total.toString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/quotations/${quotation.id}`}>
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
              href={`/quotations?query=${encodeURIComponent(query)}&page=${page - 1}`}
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
              href={`/quotations?query=${encodeURIComponent(query)}&page=${page + 1}`}
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
