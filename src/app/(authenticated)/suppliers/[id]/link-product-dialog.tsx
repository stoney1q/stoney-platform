'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LinkProductSupplierValues,
  linkProductSupplierSchema,
} from '@/lib/suppliers/validation';
import { linkProductToSupplier } from '@/lib/suppliers/actions';

export function LinkProductDialog({
  supplierId,
  products,
}: {
  supplierId: string;
  products: { id: string; name: string; sku: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LinkProductSupplierValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(linkProductSupplierSchema) as any,
    defaultValues: {
      productId: '',
      supplierId: supplierId,
      supplierSku: '',
      unitCost: '',
      isPreferred: false,
    },
  });

  const onSubmit = async (data: LinkProductSupplierValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await linkProductToSupplier(data);
      if (result.success) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        setError(result.error || 'Failed to link product');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Link Product</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Product to Supplier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="bg-destructive/15 text-destructive rounded-md p-3 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="productId">Product *</Label>
            <select
              id="productId"
              {...register('productId')}
              disabled={isSubmitting}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
            {errors.productId && (
              <p className="text-destructive text-sm">
                {errors.productId.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplierSku">Supplier SKU</Label>
            <Input
              id="supplierSku"
              {...register('supplierSku')}
              disabled={isSubmitting}
              placeholder="Vendor's internal SKU"
            />
            {errors.supplierSku && (
              <p className="text-destructive text-sm">
                {errors.supplierSku.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="unitCost">Unit Cost *</Label>
            <Input
              id="unitCost"
              type="number"
              step="0.01"
              {...register('unitCost')}
              disabled={isSubmitting}
            />
            {errors.unitCost && (
              <p className="text-destructive text-sm">
                {errors.unitCost.message}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="isPreferred"
              {...register('isPreferred')}
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="isPreferred">Preferred Supplier</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Link Product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
