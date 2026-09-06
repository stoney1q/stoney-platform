'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { adjustStock } from '@/lib/inventory/actions';
import { useRouter } from 'next/navigation';

interface StockRowActionsProps {
  productId: string;
  productName: string;
  branchId: string;
  onHand: number;
}

export function StockRowActions({
  productId,
  productName,
  branchId,
  onHand,
}: StockRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const onAdjust = async () => {
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty === 0) return alert('Invalid quantity (cannot be 0)');
    if (!adjustReason || adjustReason.length < 3)
      return alert('Reason required');

    startTransition(async () => {
      try {
        await adjustStock(branchId, productId, qty, adjustReason);
        alert('Stock adjusted successfully');
        setOpen(false);
        setAdjustQty('');
        setAdjustReason('');
        router.refresh();
      } catch (error) {
        const err = error as Error;
        alert('Error adjusting stock: ' + err.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            Quick Adjust
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Adjust Stock</DialogTitle>
          <DialogDescription>
            Adjust inventory for <strong>{productName}</strong>. Current
            on-hand: {onHand}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Quantity Delta (+ or -)</Label>
            <Input
              type="number"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              placeholder="-5 or 5"
            />
          </div>
          <div className="grid gap-2">
            <Label>Reason</Label>
            <Input
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="E.g. Cycle count discrepancy"
            />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={isPending} onClick={onAdjust}>
            {isPending ? 'Processing...' : 'Apply Adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
