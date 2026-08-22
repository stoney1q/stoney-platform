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
  addQuotationItem,
  removeQuotationItem,
  updateQuotationStatus,
  convertQuotationToSale,
} from '@/lib/quotations/actions';
import {
  Customer,
  Quotation,
  QuotationItem,
  Product,
  BranchStock,
  QuotationStatus,
  Sale,
} from '@/generated/prisma/client';
import Link from 'next/link';

type QuotationWithRelations = Quotation & {
  customer: Customer;
  items: QuotationItem[];
  sale: Sale | null;
};

type ProductWithStock = Product & {
  branchStocks: BranchStock[];
};

export function QuotationDetailsClient({
  quotation,
  availableProducts,
}: {
  quotation: QuotationWithRelations;
  availableProducts: ProductWithStock[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleAddItem(formData: FormData) {
    setError(null);
    setIsPending(true);
    formData.append('quotationId', quotation.id);
    try {
      await addQuotationItem(formData);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add item');
    } finally {
      setIsPending(false);
    }
  }

  async function handleRemoveItem(quotationItemId: string) {
    if (!confirm('Are you sure you want to remove this item?')) return;
    setError(null);
    setIsPending(true);
    const formData = new FormData();
    formData.append('quotationId', quotation.id);
    formData.append('quotationItemId', quotationItemId);
    try {
      await removeQuotationItem(formData);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove item');
    } finally {
      setIsPending(false);
    }
  }

  async function handleUpdateStatus(status: QuotationStatus) {
    if (!confirm(`Are you sure you want to mark this quotation as ${status}?`))
      return;
    setError(null);
    setIsPending(true);
    const formData = new FormData();
    formData.append('quotationId', quotation.id);
    formData.append('status', status);
    try {
      await updateQuotationStatus(formData);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `Failed to mark as ${status}`);
    } finally {
      setIsPending(false);
    }
  }

  async function handleConvertToSale() {
    if (!confirm('Are you sure you want to convert this quotation to a sale?'))
      return;
    setError(null);
    setIsPending(true);
    const formData = new FormData();
    formData.append('quotationId', quotation.id);
    try {
      const sale = await convertQuotationToSale(formData);
      router.push(`/sales/${sale.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to convert to sale');
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      {/* Quotation Info Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-sm font-medium">
            Status
          </div>
          <div className="mt-1 text-lg font-semibold">
            {quotation.status === 'CONVERTED' && (
              <span className="text-green-600">CONVERTED</span>
            )}
            {quotation.status === 'ACCEPTED' && (
              <span className="text-blue-600">ACCEPTED</span>
            )}
            {(quotation.status === 'DRAFT' || quotation.status === 'SENT') && (
              <span className="text-yellow-600">{quotation.status}</span>
            )}
            {(quotation.status === 'REJECTED' ||
              quotation.status === 'EXPIRED') && (
              <span className="text-red-600">{quotation.status}</span>
            )}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-sm font-medium">
            Customer
          </div>
          <div className="mt-1 text-lg font-semibold">
            {quotation.customer.firstName} {quotation.customer.lastName}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-sm font-medium">Total</div>
          <div className="mt-1 text-lg font-semibold">
            ${Number(quotation.total).toFixed(2)}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-sm font-medium">
            Valid Until
          </div>
          <div className="mt-1 text-lg font-semibold">
            {quotation.validUntil
              ? quotation.validUntil.toLocaleDateString()
              : 'N/A'}
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Quotation Items</h3>
        </div>

        {quotation.status === 'DRAFT' && (
          <div className="bg-card rounded-lg border p-4">
            <form action={handleAddItem} className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-medium">
                  Product (Goods/Services)
                </label>
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
                    const stockLabel =
                      p.type === 'SERVICE' ? 'Service' : `${stock} in stock`;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} - ${Number(p.sellingPrice).toFixed(2)} (
                        {stockLabel})
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
                <TableHead>Type</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
                {quotation.status === 'DRAFT' && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotation.items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={quotation.status === 'DRAFT' ? 8 : 7}
                    className="text-muted-foreground text-center"
                  >
                    No items added yet.
                  </TableCell>
                </TableRow>
              ) : (
                quotation.items.map((item: QuotationItem) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell>
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-800">
                        {item.productType}
                      </span>
                    </TableCell>
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
                    {quotation.status === 'DRAFT' && (
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

      {/* Action Buttons */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-bold">Actions</h3>

        {quotation.status === 'DRAFT' && quotation.items.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleUpdateStatus('SENT')}
              disabled={isPending}
            >
              Mark as Sent
            </Button>
          </div>
        )}

        {quotation.status === 'SENT' && (
          <div className="flex gap-2">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => handleUpdateStatus('ACCEPTED')}
              disabled={isPending}
            >
              Mark as Accepted
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleUpdateStatus('REJECTED')}
              disabled={isPending}
            >
              Mark as Rejected
            </Button>
          </div>
        )}

        {quotation.status === 'ACCEPTED' && (
          <div className="flex gap-2">
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleConvertToSale}
              disabled={isPending}
            >
              Convert to Sale
            </Button>
            <Button
              variant="outline"
              onClick={() => handleUpdateStatus('SENT')}
              disabled={isPending}
            >
              Revert to Sent
            </Button>
          </div>
        )}

        {quotation.status === 'CONVERTED' && quotation.sale && (
          <div className="flex gap-2">
            <Link href={`/sales/${quotation.sale.id}`}>
              <Button variant="outline">
                View Sale {quotation.sale.id.slice(0, 8)}...
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
