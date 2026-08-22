'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createQuotation } from '@/lib/quotations/actions';
import { Customer } from '@/generated/prisma/client';

export function NewQuotationForm({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function action(formData: FormData) {
    setError(null);
    setIsPending(true);
    try {
      const quotation = await createQuotation(formData);
      router.push(`/quotations/${quotation.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create quotation');
      setIsPending(false);
    }
  }

  return (
    <form action={action} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="customerId" className="text-sm font-medium">
          Select Customer
        </label>
        <select
          id="customerId"
          name="customerId"
          required
          className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
        >
          <option value="" disabled selected>
            -- Choose a customer --
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName} (CUS-
              {c.sequence.toString().padStart(6, '0')})
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          Only recent customers are shown here for this MVP.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="validUntil" className="text-sm font-medium">
          Valid Until (Optional)
        </label>
        <input
          type="date"
          id="validUntil"
          name="validUntil"
          className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/quotations')}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Starting...' : 'Create Quotation'}
        </Button>
      </div>
    </form>
  );
}
