import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/guard';
import { getSupplier } from '@/lib/suppliers/actions';
import { SupplierForm } from '../supplier-form';
import { LinkProductDialog } from './link-product-dialog';
import { UnlinkProductButton } from './unlink-product-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePermission('suppliers:read');

  const { id } = await params;
  const { q } = await searchParams;
  const result = await getSupplier(id);

  if (!result.success || !result.data) {
    notFound();
  }

  const supplier = result.data;

  const products = await prisma.product.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      sku: true,
    },
    take: 50,
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{supplier.name}</h2>
        <p className="text-muted-foreground">
          Manage supplier details and catalog.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="bg-card rounded-lg border p-6">
            <h3 className="mb-4 text-lg font-medium">Supplier Details</h3>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-3">
                <span className="text-muted-foreground">Contact:</span>
                <span className="col-span-2 font-medium">
                  {supplier.contactName || 'None'}
                </span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-muted-foreground">Email:</span>
                <span className="col-span-2 font-medium">
                  {supplier.email || 'None'}
                </span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-muted-foreground">Phone:</span>
                <span className="col-span-2 font-medium">
                  {supplier.phone || 'None'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-lg border p-6">
            <h3 className="mb-4 text-lg font-medium">Edit Details</h3>
            <SupplierForm
              initialData={{
                name: supplier.name,
                contactName: supplier.contactName,
                email: supplier.email,
                phone: supplier.phone,
              }}
              supplierId={supplier.id}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Linked Products</h3>
          <div className="flex items-center gap-4">
            <form method="GET" className="flex items-center gap-2">
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search catalog to link..."
                className="border-input focus-visible:ring-ring flex h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
              />
              <button
                type="submit"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-ring inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              >
                Search
              </button>
            </form>
            <LinkProductDialog supplierId={supplier.id} products={products} />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Supplier SKU</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Preferred</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplier.products.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground text-center"
                  >
                    No products linked to this supplier.
                  </TableCell>
                </TableRow>
              ) : (
                supplier.products.map((ps) => (
                  <TableRow key={ps.productId}>
                    <TableCell className="font-medium">
                      {ps.product.sku}
                    </TableCell>
                    <TableCell>{ps.product.name}</TableCell>
                    <TableCell>{ps.supplierSku || '-'}</TableCell>
                    <TableCell>${Number(ps.unitCost).toFixed(2)}</TableCell>
                    <TableCell>
                      {ps.isPreferred ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                          Yes
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <UnlinkProductButton
                        productId={ps.productId}
                        supplierId={ps.supplierId}
                        productName={ps.product.name}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
