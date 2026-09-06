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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { receiveStock, adjustStock } from '@/lib/inventory/actions';
import { useRouter } from 'next/navigation';

interface StockActionsProps {
  products: { id: string; name: string; sku: string }[];
  suppliers: { id: string; name: string }[];
  currentBranchId: string;
}

export function StockActions({
  products,
  suppliers,
  currentBranchId,
}: StockActionsProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  // Form State - Receive
  const [receiveProductId, setReceiveProductId] = useState('');
  const [receiveQty, setReceiveQty] = useState('');
  const [receiveSupplierId, setReceiveSupplierId] = useState('');

  // Form State - Adjust
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const onReceive = async () => {
    if (!receiveProductId) return alert('Select a product');
    const qty = parseInt(receiveQty, 10);
    if (isNaN(qty) || qty <= 0) return alert('Invalid quantity');

    startTransition(async () => {
      try {
        const reason = receiveSupplierId
          ? 'Receipt from Supplier'
          : 'Direct stock receipt';
        await receiveStock(
          currentBranchId,
          receiveProductId,
          qty,
          reason,
          receiveSupplierId || undefined
        );
        alert('Stock received successfully');
        setReceiveOpen(false);
        resetForms();
        router.refresh();
      } catch (error) {
        const err = error as Error;
        alert('Error receiving stock: ' + err.message);
      }
    });
  };

  const onAdjust = async () => {
    if (!adjustProductId) return alert('Select a product');
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty === 0) return alert('Invalid quantity (cannot be 0)');
    if (!adjustReason || adjustReason.length < 3)
      return alert('Reason required');

    startTransition(async () => {
      try {
        await adjustStock(currentBranchId, adjustProductId, qty, adjustReason);
        alert('Stock adjusted successfully');
        setAdjustOpen(false);
        resetForms();
        router.refresh();
      } catch (error) {
        const err = error as Error;
        alert('Error adjusting stock: ' + err.message);
      }
    });
  };

  const resetForms = () => {
    setReceiveProductId('');
    setReceiveQty('');
    setReceiveSupplierId('');
    setAdjustProductId('');
    setAdjustQty('');
    setAdjustReason('');
  };

  return (
    <div className="flex gap-2">
      {/* RECEIVE DIALOG */}
      <Dialog
        open={receiveOpen}
        onOpenChange={(o) => {
          setReceiveOpen(o);
          if (!o) resetForms();
        }}
      >
        <DialogTrigger
          render={<Button variant="default">Receive Stock</Button>}
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Stock</DialogTitle>
            <DialogDescription>
              Record incoming stock from a supplier.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Product</Label>
              <Select
                value={receiveProductId}
                onValueChange={(v) => setReceiveProductId(v || '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.sku} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                value={receiveQty}
                onChange={(e) => setReceiveQty(e.target.value)}
                placeholder="10"
              />
            </div>
            <div className="grid gap-2">
              <Label>Supplier (Optional)</Label>
              <Select
                value={receiveSupplierId}
                onValueChange={(v) => setReceiveSupplierId(v || '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={isPending} onClick={onReceive}>
              {isPending ? 'Processing...' : 'Receive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADJUST DIALOG */}
      <Dialog
        open={adjustOpen}
        onOpenChange={(o) => {
          setAdjustOpen(o);
          if (!o) resetForms();
        }}
      >
        <DialogTrigger
          render={<Button variant="outline">Adjust Stock</Button>}
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Manually adjust inventory levels (e.g. for cycle counts or
              write-offs).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Product</Label>
              <Select
                value={adjustProductId}
                onValueChange={(v) => setAdjustProductId(v || '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.sku} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
    </div>
  );
}
