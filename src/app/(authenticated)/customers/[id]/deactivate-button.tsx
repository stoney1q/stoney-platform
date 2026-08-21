'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { deactivateCustomer } from '@/lib/customers/actions';

export function DeactivateCustomerButton({
  customerId,
}: {
  customerId: string;
}) {
  const router = useRouter();
  const [isDeactivating, setIsDeactivating] = useState(false);

  const handleDeactivate = async () => {
    if (
      !confirm(
        'Are you sure you want to deactivate this customer? They will remain in the system for historical records but will be hidden from default lookups.'
      )
    ) {
      return;
    }

    setIsDeactivating(true);
    const result = await deactivateCustomer(customerId);

    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || 'Failed to deactivate customer');
      setIsDeactivating(false);
    }
  };

  return (
    <Button
      variant="destructive"
      onClick={handleDeactivate}
      disabled={isDeactivating}
    >
      {isDeactivating ? 'Deactivating...' : 'Deactivate'}
    </Button>
  );
}
