import { requirePermission } from '@/lib/auth/guard';
import { getCategories, getBrands } from '@/lib/inventory/taxonomy-actions';
import { TaxonomyClient } from './taxonomy-client';

export default async function TaxonomyPage() {
  await requirePermission('products:read');

  const [categories, brands] = await Promise.all([
    getCategories(),
    getBrands(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Taxonomy</h2>
        <p className="text-muted-foreground">
          Manage product categories and brands.
        </p>
      </div>

      <TaxonomyClient initialCategories={categories} initialBrands={brands} />
    </div>
  );
}
