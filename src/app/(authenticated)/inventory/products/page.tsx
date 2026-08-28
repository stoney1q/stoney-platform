import { requirePermission } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ProductFormDialog } from './product-form';
import { ProductMediaDialog } from './product-media-dialog';
import { getCategories, getBrands } from '@/lib/inventory/taxonomy-actions';
import Link from 'next/link';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; brandId?: string }>;
}) {
  await requirePermission('inventory:read');

  const { categoryId, brandId } = await searchParams;

  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...(categoryId ? { categoryId } : {}),
        ...(brandId ? { brandId } : {}),
      },
      include: {
        category: true,
        brand: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    getCategories(),
    getBrands(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">
            Manage the product catalog and SKUs.
          </p>
        </div>
        <ProductFormDialog categories={categories} brands={brands} />
      </div>

      <div className="flex gap-4">
        <form className="flex gap-4">
          <select
            name="categoryId"
            defaultValue={categoryId || ''}
            className="border-input h-9 rounded-md border px-3 text-sm"
            onChange={(e) => e.target.form?.submit()}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            name="brandId"
            defaultValue={brandId || ''}
            className="border-input h-9 rounded-md border px-3 text-sm"
            onChange={(e) => e.target.form?.submit()}
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <noscript>
            <Button type="submit" variant="secondary" size="sm">
              Filter
            </Button>
          </noscript>

          {(categoryId || brandId) && (
            <Link href="/inventory/products">
              <Button type="button" variant="ghost" size="sm">
                Clear
              </Button>
            </Link>
          )}
        </form>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground text-center"
                >
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.sku}</TableCell>
                  <TableCell>
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-800">
                      {product.type}
                    </span>
                  </TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.category?.name || '-'}</TableCell>
                  <TableCell>{product.brand?.name || '-'}</TableCell>
                  <TableCell>
                    ${Number(product.sellingPrice).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {product.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <ProductMediaDialog productId={product.id} productName={product.name} />
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
