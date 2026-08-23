'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Customer } from '@/generated/prisma/client';
import { createRepair, getCustomerDevices } from '@/lib/repairs/actions';
import { Device } from '@/generated/prisma/client';

export function NewRepairForm({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);

  useEffect(() => {
    let active = true;

    const loadDevices = async () => {
      if (!selectedCustomerId) {
        if (active) setDevices([]);
        return;
      }
      setIsLoadingDevices(true);
      try {
        const fetchedDevices = await getCustomerDevices(selectedCustomerId);
        if (active) setDevices(fetchedDevices);
      } catch (err) {
        console.error('Failed to load devices', err);
      } finally {
        if (active) setIsLoadingDevices(false);
      }
    };

    loadDevices();

    return () => {
      active = false;
    };
  }, [selectedCustomerId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const repair = await createRepair(formData);
      if (repair) {
        router.push(`/repairs/${repair.id}`);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred.'
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="customerId" className="text-sm font-medium">
          Customer
        </label>
        <select
          id="customerId"
          name="customerId"
          required
          className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
          value={selectedCustomerId}
          onChange={(e) => setSelectedCustomerId(e.target.value)}
        >
          <option value="" disabled>
            Select a customer...
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName} ({c.email})
            </option>
          ))}
        </select>
        {customers.length === 0 && (
          <p className="text-muted-foreground text-xs">
            No customers available. Please create a customer first.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="deviceId" className="text-sm font-medium">
          Device
        </label>
        <select
          id="deviceId"
          name="deviceId"
          required
          disabled={!selectedCustomerId || isLoadingDevices}
          className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" disabled>
            {isLoadingDevices ? 'Loading devices...' : 'Select a device...'}
          </option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.make} {d.model}{' '}
              {d.serialNumber ? `(SN: ${d.serialNumber})` : ''}
            </option>
          ))}
        </select>
        {selectedCustomerId && devices.length === 0 && !isLoadingDevices && (
          <p className="text-muted-foreground text-xs text-orange-600">
            This customer has no devices. A device must be added to the customer
            first.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="issue" className="text-sm font-medium">
          Reported Issue
        </label>
        <textarea
          id="issue"
          name="issue"
          required
          rows={3}
          placeholder="Describe the issue reported by the customer..."
          className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className="text-sm font-medium">
          Internal Notes (Optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Physical condition, accessories included, etc."
          className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !selectedCustomerId || devices.length === 0}
        >
          {isSubmitting ? 'Creating...' : 'Create Repair'}
        </Button>
      </div>
    </form>
  );
}
