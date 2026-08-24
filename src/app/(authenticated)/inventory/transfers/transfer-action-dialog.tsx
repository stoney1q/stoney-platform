'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  dispatchTransfer,
  receiveTransfer,
  cancelTransfer,
} from '@/lib/inventory/actions';
import { TransferItem } from './transfers-client';

interface TransferActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: TransferItem;
}

export function TransferActionDialog({
  isOpen,
  onClose,
  transfer,
}: TransferActionDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAction = (action: 'DISPATCH' | 'RECEIVE' | 'CANCEL') => {
    setError(null);
    startTransition(async () => {
      try {
        if (action === 'DISPATCH') await dispatchTransfer(transfer.id);
        if (action === 'RECEIVE') await receiveTransfer(transfer.id);
        if (action === 'CANCEL') await cancelTransfer(transfer.id);
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
          <h2 className="text-xl font-medium">Manage Transfer</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-6 space-y-4">
          <div className="text-sm">
            <span className="font-medium text-gray-700">Product:</span>{' '}
            {transfer.product.sku} - {transfer.product.name}
          </div>
          <div className="text-sm">
            <span className="font-medium text-gray-700">Quantity:</span>{' '}
            {transfer.quantity}
          </div>
          <div className="text-sm">
            <span className="font-medium text-gray-700">Route:</span>{' '}
            {transfer.origin.name} → {transfer.destination.name}
          </div>
          <div className="text-sm">
            <span className="font-medium text-gray-700">Status:</span>{' '}
            <span className="font-bold">{transfer.status}</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Close
          </Button>

          {transfer.status === 'PENDING' && (
            <>
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => handleAction('CANCEL')}
              >
                {isPending ? 'Processing...' : 'Cancel'}
              </Button>
              <Button
                type="button"
                disabled={isPending}
                onClick={() => handleAction('DISPATCH')}
              >
                {isPending ? 'Processing...' : 'Dispatch'}
              </Button>
            </>
          )}

          {transfer.status === 'IN_TRANSIT' && (
            <Button
              type="button"
              disabled={isPending}
              onClick={() => handleAction('RECEIVE')}
            >
              {isPending ? 'Processing...' : 'Receive'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
