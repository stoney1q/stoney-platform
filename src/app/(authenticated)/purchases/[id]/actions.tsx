'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  markPurchaseOrderOrdered,
  cancelPurchaseOrder,
} from '@/lib/purchases/actions';
import { toast } from 'sonner';
import ReceiveModal from './receive-modal';
import { Prisma } from '@/generated/prisma/client';

type PurchaseOrderWithRelations = Prisma.PurchaseOrderGetPayload<{
  include: { items: true; supplier: true };
}>;

export default function PurchaseOrderActions({
  po,
}: {
  po: PurchaseOrderWithRelations;
}) {
  const router = useRouter();
  const [isOrdering, setIsOrdering] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleOrder = async () => {
    setIsOrdering(true);
    const result = await markPurchaseOrderOrdered(po.id);
    if (!result.success) {
      toast.error(result.error);
    } else {
      toast.success('Purchase order marked as ORDERED');
      router.refresh();
    }
    setIsOrdering(false);
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this purchase order?'))
      return;
    setIsCancelling(true);
    const result = await cancelPurchaseOrder(po.id);
    if (!result.success) {
      toast.error(result.error);
    } else {
      toast.success('Purchase order cancelled');
      router.refresh();
    }
    setIsCancelling(false);
  };

  return (
    <div className="flex items-center space-x-2">
      {po.status === 'DRAFT' && (
        <>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isCancelling}
          >
            Cancel Order
          </Button>
          <Button onClick={handleOrder} disabled={isOrdering}>
            Mark as Ordered
          </Button>
        </>
      )}

      {(po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED') && (
        <>
          {po.status === 'ORDERED' && (
            <Button
              variant="outline"
              className="text-red-500 hover:text-red-600"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              Cancel Order
            </Button>
          )}
          <ReceiveModal po={po} />
        </>
      )}
    </div>
  );
}
