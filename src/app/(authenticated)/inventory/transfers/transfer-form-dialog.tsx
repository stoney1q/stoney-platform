'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { createTransfer } from '@/lib/inventory/actions';

interface TransferFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  branches: { id: string; name: string }[];
  products: { id: string; sku: string; name: string }[];
  currentBranchId: string;
}

export function TransferFormDialog({
  isOpen,
  onClose,
  branches,
  products,
  currentBranchId,
}: TransferFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const originId = formData.get('originId') as string;
    const destinationId = formData.get('destinationId') as string;
    const productId = formData.get('productId') as string;
    const quantity = parseInt(formData.get('quantity') as string, 10);

    startTransition(async () => {
      try {
        await createTransfer(originId, destinationId, productId, quantity);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-medium">New Transfer</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Origin Branch *
            </label>
            <select
              name="originId"
              defaultValue={currentBranchId}
              required
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Destination Branch *
            </label>
            <select
              name="destinationId"
              required
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="" disabled selected>
                Select destination
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Product *
            </label>
            <select
              name="productId"
              required
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="" disabled selected>
                Select product
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Quantity *
            </label>
            <input
              type="number"
              name="quantity"
              min="1"
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end space-x-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Transfer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
