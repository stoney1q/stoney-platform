'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { returnSaleItem } from '@/lib/sales/actions';
import { SaleItem, Sale } from '@/generated/prisma/client';

export function ReturnItemDialog({
  sale,
  item,
}: {
  sale: Sale;
  item: SaleItem;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = item.quantity - item.returnedQuantity;
  const [quantity, setQuantity] = useState(1);

  // Proportional refund calculation based on subtotal/total
  const lineRefund = Number(item.total) / item.quantity;
  const ratio =
    Number(sale.subtotal) > 0 ? Number(sale.total) / Number(sale.subtotal) : 1;
  const suggestedRefund = (lineRefund * ratio * quantity).toFixed(2);

  async function handleReturn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.append('saleId', sale.id);
    formData.append('saleItemId', item.id);

    try {
      await returnSaleItem(formData);
      setOpen(false);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to return item');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="border-input hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium whitespace-nowrap text-orange-600 shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
        Return
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return Item: {item.productName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleReturn} className="space-y-4 pt-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Quantity (Max: {remaining})
            </label>
            <input
              type="number"
              name="quantity"
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  Math.min(remaining, Math.max(1, Number(e.target.value)))
                )
              }
              min={1}
              max={remaining}
              required
              className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 shadow-sm focus-visible:ring-1 focus-visible:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Refund Amount ($)</label>
            <input
              type="number"
              name="refundAmount"
              defaultValue={suggestedRefund}
              key={suggestedRefund}
              step="0.01"
              min={0}
              required
              className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 shadow-sm focus-visible:ring-1 focus-visible:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Refund Method</label>
            <select
              name="refundMethod"
              required
              className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 shadow-sm focus-visible:ring-1 focus-visible:outline-none"
            >
              {['CASH', 'CARD', 'TRANSFER', 'OTHER'].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              Confirm Return
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
