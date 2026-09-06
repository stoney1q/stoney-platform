'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createPurchaseOrder } from '@/lib/purchases/actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Product = { id: string; name: string; sku: string; unitCost: number };

export default function CreatePurchaseOrderForm({
  branchId,
  suppliers,
  productsBySupplier,
}: {
  branchId: string;
  suppliers: { id: string; name: string }[];
  productsBySupplier: Record<string, Product[]>;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supplierId, setSupplierId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<
    Array<{ productId: string; quantity: number }>
  >([]);

  const availableProducts = supplierId
    ? productsBySupplier[supplierId] || []
    : [];

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleItemChange = (
    index: number,
    field: string,
    value: string | number
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotal = () => {
    if (!supplierId) return 0;
    return items.reduce((sum, item) => {
      const product = availableProducts.find((p) => p.id === item.productId);
      if (product) {
        return sum + product.unitCost * item.quantity;
      }
      return sum;
    }, 0);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return toast.error('Please select a supplier');
    if (items.length === 0) return toast.error('Please add at least one item');
    if (items.some((i) => !i.productId || i.quantity < 1)) {
      return toast.error(
        'Please select a product and valid quantity for all items'
      );
    }

    setIsSubmitting(true);
    const result = await createPurchaseOrder({
      branchId,
      supplierId,
      notes,
      items,
    });

    if (!result.success) {
      toast.error(result.error);
      setIsSubmitting(false);
    } else {
      toast.success('Purchase order created successfully');
      router.push(`/purchases/${result.data?.id}`);
    }
  };

  return (
    <form onSubmit={onSubmit} className="max-w-4xl space-y-8">
      <div className="grid gap-4 rounded-lg border p-4">
        <div className="grid gap-2">
          <Label htmlFor="supplier">Supplier</Label>
          <Select
            value={supplierId}
            onValueChange={(val) => {
              setSupplierId(val as string);
              setItems([]); // reset items when supplier changes
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes for this order"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Order Items</h3>
          <Button
            type="button"
            variant="outline"
            onClick={handleAddItem}
            disabled={!supplierId || availableProducts.length === 0}
          >
            Add Item
          </Button>
        </div>

        {supplierId && availableProducts.length === 0 && (
          <p className="text-sm text-yellow-600">
            This supplier has no mapped products.
          </p>
        )}

        <div className="divide-y rounded-md border">
          {items.map((item, index) => {
            const selectedProduct = availableProducts.find(
              (p) => p.id === item.productId
            );
            const subtotal = selectedProduct
              ? selectedProduct.unitCost * item.quantity
              : 0;

            return (
              <div key={index} className="flex items-center gap-4 p-4">
                <div className="flex-1">
                  <Select
                    value={item.productId}
                    onValueChange={(val) =>
                      handleItemChange(index, 'productId', val as string)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.sku}) - ${p.unitCost.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-32">
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity || ''}
                    onChange={(e) =>
                      handleItemChange(
                        index,
                        'quantity',
                        parseInt(e.target.value) || 0
                      )
                    }
                    placeholder="Qty"
                  />
                </div>

                <div className="w-24 text-right font-medium">
                  ${subtotal.toFixed(2)}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveItem(index)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="text-muted-foreground p-8 text-center">
              No items added. Click &quot;Add Item&quot; to begin.
            </div>
          )}
        </div>

        <div className="flex justify-end text-xl font-bold">
          Total: ${calculateTotal().toFixed(2)}
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || items.length === 0}>
          {isSubmitting ? 'Creating...' : 'Create Purchase Order'}
        </Button>
      </div>
    </form>
  );
}
