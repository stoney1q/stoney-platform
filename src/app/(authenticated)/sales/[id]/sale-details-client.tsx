'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  addSaleItem,
  removeSaleItem,
  applyPayment,
  cancelSale,
} from '@/lib/sales/actions';

export function SaleDetailsClient({
  sale,
  availableProducts,
}: {
  sale: any;
  availableProducts: any[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleAddItem(formData: FormData) {
    setError(null);
    setIsPending(true);
    formData.append('saleId', sale.id);
    try {
      await addSaleItem(formData);
      router.refresh();
    } catch (e: any) {
      setError(e.message || 'Failed to add item');
    } finally {
      setIsPending(false);
    }
  }

  async function handleRemoveItem(saleItemId: string) {
    if (!confirm('Are you sure you want to remove this item?')) return;
    setError(null);
    setIsPending(true);
    const formData = new FormData();
    formData.append('saleId', sale.id);
    formData.append('saleItemId', saleItemId);
    try {
      await removeSaleItem(formData);
      router.refresh();
    } catch (e: any) {
      setError(e.message || 'Failed to remove item');
    } finally {
      setIsPending(false);
    }
  }

  async function handleApplyPayment(formData: FormData) {
    setError(null);
    setIsPending(true);
    formData.append('saleId', sale.id);
    try {
      await applyPayment(formData);
      router.refresh();
    } catch (e: any) {
      setError(e.message || 'Failed to apply payment');
    } finally {
      setIsPending(false);
    }
  }

  async function handleCancelSale() {
    if (!confirm('Are you sure you want to cancel this sale?')) return;
    setError(null);
    setIsPending(true);
    const formData = new FormData();
    formData.append('saleId', sale.id);
    try {
      await cancelSale(formData);
      router.refresh();
    } catch (e: any) {
      setError(e.message || 'Failed to cancel sale');
    } finally {
      setIsPending(false);
    }
  }

  const amountPaid = sale.payments.reduce(
    (sum: number, p: any) => sum + Number(p.amount),
    0
  );
  const remaining = Number(sale.total) - amountPaid;

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      {/* Sale Info Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-sm font-medium">
            Status
          </div>
          <div className="mt-1 text-lg font-semibold">
            {sale.status === 'COMPLETED' && (
              <span className="text-green-600">COMPLETED</span>
            )}
            {sale.status === 'PENDING' && (
              <span className="text-yellow-600">PENDING</span>
            )}
            {sale.status === 'CANCELLED' && (
              <span className="text-red-600">CANCELLED</span>
            )}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-sm font-medium">
            Customer
          </div>
          <div className="mt-1 text-lg font-semibold">
            {sale.customer.firstName} {sale.customer.lastName}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-sm font-medium">Total</div>
          <div className="mt-1 text-lg font-semibold">
            ${Number(sale.total).toFixed(2)}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-sm font-medium">
            Amount Paid
          </div>
          <div className="mt-1 text-lg font-semibold">
            ${amountPaid.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Sale Items</h3>
        </div>

        {sale.status === 'PENDING' && (
          <div className="bg-card rounded-lg border p-4">
            <form action={handleAddItem} className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-medium">Product</label>
                <select
                  name="productId"
                  required
                  className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                >
                  <option value="" disabled selected>
                    -- Choose Product --
                  </option>
                  {availableProducts.map((p) => {
                    const stock = p.branchStocks[0]?.onHand || 0;
                    return (
                      <option key={p.id} value={p.id} disabled={stock <= 0}>
                        {p.name} - ${Number(p.sellingPrice).toFixed(2)} ({stock}{' '}
                        in stock)
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="w-24 space-y-2">
                <label className="text-xs font-medium">Qty</label>
                <input
                  type="number"
                  name="quantity"
                  defaultValue={1}
                  min={1}
                  required
                  className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                />
              </div>
              <div className="w-24 space-y-2">
                <label className="text-xs font-medium">Discount ($)</label>
                <input
                  type="number"
                  name="discount"
                  defaultValue={0}
                  min={0}
                  step="0.01"
                  className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                />
              </div>
              <Button type="submit" disabled={isPending}>
                Add Item
              </Button>
            </form>
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
                {sale.status === 'PENDING' && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={sale.status === 'PENDING' ? 7 : 6}
                    className="text-muted-foreground text-center"
                  >
                    No items added yet.
                  </TableCell>
                </TableRow>
              ) : (
                sale.items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell className="font-medium">
                      {item.productName}
                    </TableCell>
                    <TableCell className="text-right">
                      ${Number(item.unitPrice).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      ${Number(item.discount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${Number(item.total).toFixed(2)}
                    </TableCell>
                    {sale.status === 'PENDING' && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={isPending}
                          className="text-red-600"
                        >
                          Remove
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Payments Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Payments</h3>

        {sale.status === 'PENDING' &&
          remaining > 0 &&
          sale.items.length > 0 && (
            <div className="bg-card rounded-lg border p-4">
              <form
                action={handleApplyPayment}
                className="flex items-end gap-2"
              >
                <div className="w-32 space-y-2">
                  <label className="text-xs font-medium">Method</label>
                  <select
                    name="method"
                    required
                    className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                  >
                    {['CASH', 'CARD', 'TRANSFER', 'OTHER'].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-32 space-y-2">
                  <label className="text-xs font-medium">Amount ($)</label>
                  <input
                    type="number"
                    name="amount"
                    defaultValue={remaining}
                    min={0.01}
                    max={remaining}
                    step="0.01"
                    required
                    className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-medium">Reference</label>
                  <input
                    type="text"
                    name="reference"
                    placeholder="e.g. Receipt #, Cheque #"
                    required
                    className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                  />
                </div>
                <Button type="submit" disabled={isPending}>
                  Apply Payment
                </Button>
              </form>
            </div>
          )}

        {sale.payments.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.payments.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {new Date(p.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell>{p.reference}</TableCell>
                    <TableCell className="text-right">
                      ${Number(p.amount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {sale.status === 'PENDING' && sale.payments.length === 0 && (
          <div className="flex justify-end pt-4">
            <Button
              variant="destructive"
              onClick={handleCancelSale}
              disabled={isPending}
            >
              Cancel Sale
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
