import { requirePermission } from '@/lib/auth/guard';
import { searchSuppliers } from '@/lib/suppliers/actions';
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

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; page?: string }>;
}) {
  await requirePermission('suppliers:read');

  const { query: queryParam, page: pageParam } = await searchParams;
  const query = queryParam || '';
  const page = parseInt(pageParam || '1', 10);

  const result = await searchSuppliers({ query, page });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Suppliers</h2>
          <p className="text-muted-foreground">
            Manage your vendor database for purchasing and inventory.
          </p>
        </div>
        <Link href="/suppliers/new">
          <Button>Add Supplier</Button>
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
            placeholder="Search by name, contact, email..."
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
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!result.success || result.data?.suppliers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground text-center"
                >
                  No suppliers found.
                </TableCell>
              </TableRow>
            ) : (
              result.data?.suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.contactName || '-'}</TableCell>
                  <TableCell>{supplier.phone || '-'}</TableCell>
                  <TableCell>{supplier.email || '-'}</TableCell>
                  <TableCell>
                    {supplier.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/suppliers/${supplier.id}`}>
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
              href={`/suppliers?query=${encodeURIComponent(query)}&page=${page - 1}`}
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
              href={`/suppliers?query=${encodeURIComponent(query)}&page=${page + 1}`}
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
