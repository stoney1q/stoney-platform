'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { receivePurchaseOrder } from '@/lib/purchases/actions';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Prisma } from '@/generated/prisma/client';

type PurchaseOrderWithRelations = Prisma.PurchaseOrderGetPayload<{
  include: { items: true; supplier: true };
}>;

export default function ReceiveModal({
  po,
}: {
  po: PurchaseOrderWithRelations;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State maps itemId -> quantity to receive
  const [receiveQuantities, setReceiveQuantities] = useState<
    Record<string, number>
  >({});

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Initialize receive quantities to the remaining amounts
      const initial: Record<string, number> = {};
      po.items.forEach((item) => {
        const remaining = item.orderedQuantity - item.receivedQuantity;
        if (remaining > 0) {
          initial[item.id] = remaining;
        } else {
          initial[item.id] = 0;
        }
      });
      setReceiveQuantities(initial);
    }
    setOpen(newOpen);
  };

  const handleChange = (itemId: string, value: number) => {
    setReceiveQuantities((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const itemsToReceive = Object.entries(receiveQuantities)
      .map(([itemId, quantity]) => ({ itemId, quantity }))
      .filter((item) => item.quantity > 0);

    if (itemsToReceive.length === 0) {
      toast.error(
        'Please enter a quantity greater than 0 for at least one item'
      );
      setIsSubmitting(false);
      return;
    }

    const result = await receivePurchaseOrder(po.id, { items: itemsToReceive });
    if (!result.success) {
      toast.error(result.error);
      setIsSubmitting(false);
    } else {
      toast.success('Items received successfully');
      setOpen(false);
      router.refresh();
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger>
        <Button>Receive Items</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Purchase Order Items</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="divide-y rounded-md border">
            <div className="bg-muted/50 grid grid-cols-12 gap-4 p-4 text-sm font-medium">
              <div className="col-span-5">Product</div>
              <div className="col-span-2 text-right">Ordered</div>
              <div className="col-span-2 text-right">Received</div>
              <div className="col-span-3 text-right">Receiving Now</div>
            </div>

            {po.items.map((item) => {
              const remaining = item.orderedQuantity - item.receivedQuantity;

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-12 items-center gap-4 p-4"
                >
                  <div className="col-span-5 flex flex-col">
                    <span className="font-medium">{item.productName}</span>
                    <span className="text-muted-foreground text-xs">
                      {item.sku}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    {item.orderedQuantity}
                  </div>
                  <div className="col-span-2 text-right">
                    {item.receivedQuantity}
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      min={0}
                      max={remaining}
                      value={receiveQuantities[item.id] ?? 0}
                      onChange={(e) =>
                        handleChange(item.id, parseInt(e.target.value) || 0)
                      }
                      disabled={remaining === 0}
                      className="text-right"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Receiving...' : 'Confirm Receipt'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
