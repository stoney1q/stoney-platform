'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { unlinkProductFromSupplier } from '@/lib/suppliers/actions';

export function UnlinkProductButton({
  productId,
  supplierId,
  productName,
}: {
  productId: string;
  supplierId: string;
  productName: string;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleUnlink = async () => {
    if (!window.confirm(`Are you sure you want to unlink ${productName}?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await unlinkProductFromSupplier(productId, supplierId);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || 'Failed to unlink product');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      alert(message || 'An error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-600 hover:bg-red-50 hover:text-red-700"
      onClick={handleUnlink}
      disabled={isDeleting}
    >
      {isDeleting ? 'Removing...' : 'Remove'}
    </Button>
  );
}
