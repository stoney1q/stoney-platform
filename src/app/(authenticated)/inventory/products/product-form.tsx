'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createProduct } from '@/lib/inventory/actions';
import { ProductType, Category, Brand } from '@/generated/prisma/client';

export function ProductFormDialog({
  categories = [],
  brands = [],
}: {
  categories?: Category[];
  brands?: Brand[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsPending(true);

    try {
      const data = {
        sku: formData.get('sku') as string,
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        type: formData.get('type') as ProductType,
        sellingPrice: Number(formData.get('sellingPrice')),
        categoryId: formData.get('categoryId') as string | null,
        brandId: formData.get('brandId') as string | null,
      };

      await createProduct(data);
      setIsOpen(false);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create product');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Add Product</Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card w-full max-w-md rounded-lg p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-bold">New Product</h3>

            <form action={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded bg-red-50 p-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">SKU</label>
                <input
                  type="text"
                  name="sku"
                  required
                  className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <select
                  name="type"
                  required
                  defaultValue="GOODS"
                  className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="GOODS">GOODS (Inventory Tracked)</option>
                  <option value="SERVICE">SERVICE (No Inventory)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Selling Price ($)</label>
                <input
                  type="number"
                  name="sellingPrice"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                  required
                  className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <select
                    name="categoryId"
                    className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">-- None --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Brand</label>
                  <select
                    name="brandId"
                    className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">-- None --</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Saving...' : 'Save Product'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
