import { notFound } from 'next/navigation';
import { getSale } from '@/lib/sales/actions';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { SaleDetailsClient } from './sale-details-client';
import {
  SaleStatus,
  Product,
  BranchStock,
  Category,
  Brand,
} from '@/generated/prisma/client';
import { getCategories, getBrands } from '@/lib/inventory/taxonomy-actions';

export default async function SaleDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ categoryId?: string; brandId?: string }>;
}) {
  await requireAuth(); // just to ensure logged in
  const resolvedParams = await params;
  const { categoryId, brandId } = await searchParams;

  const sale = await getSale(resolvedParams.id);

  if (!sale) {
    notFound();
  }

  // Get products for the "Add Item" dropdown (MVP)
  let availableProducts: (Product & { branchStocks: BranchStock[] })[] = [];
  let categories: Category[] = [];
  let brands: Brand[] = [];

  if (sale.status === SaleStatus.PENDING) {
    const [fetchedProducts, fetchedCategories, fetchedBrands] =
      await Promise.all([
        prisma.product.findMany({
          where: {
            ...(categoryId ? { categoryId } : {}),
            ...(brandId ? { brandId } : {}),
            branchStocks: {
              some: {
                branchId: sale.branchId,
              },
            },
          },
          orderBy: { name: 'asc' },
          include: {
            branchStocks: {
              where: { branchId: sale.branchId },
            },
          },
        }),
        getCategories(),
        getBrands(),
      ]);
    availableProducts = fetchedProducts;
    categories = fetchedCategories;
    brands = fetchedBrands;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sale Details</h2>
        <p className="text-muted-foreground">
          View and manage sale {sale.id.slice(0, 8)}...
        </p>
      </div>

      <SaleDetailsClient
        sale={sale}
        availableProducts={availableProducts}
        categories={categories}
        brands={brands}
        categoryId={categoryId || ''}
        brandId={brandId || ''}
      />
    </div>
  );
}
