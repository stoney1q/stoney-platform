'use client';

import { useState } from 'react';
import { TransferFormDialog } from './transfer-form-dialog';
import { TransferActionDialog } from './transfer-action-dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TransferStatus } from '@/generated/prisma/client';

export type TransferItem = {
  id: string;
  status: TransferStatus;
  quantity: number;
  createdAt: Date;
  origin: { id: string; name: string };
  destination: { id: string; name: string };
  product: { id: string; sku: string; name: string };
};

interface TransfersClientProps {
  initialTransfers: TransferItem[];
  canCreate: boolean;
  canUpdate: boolean;
  branches: { id: string; name: string }[];
  products: { id: string; sku: string; name: string }[];
  currentBranchId: string;
}

export function TransfersClient({
  initialTransfers,
  canCreate,
  canUpdate,
  branches,
  products,
  currentBranchId,
}: TransfersClientProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [actionTransfer, setActionTransfer] = useState<TransferItem | null>(
    null
  );

  const getAvailableActions = (transfer: TransferItem) => {
    if (!canUpdate) return [];

    const actions: {
      label: string;
      action: 'DISPATCH' | 'RECEIVE' | 'CANCEL';
    }[] = [];

    if (transfer.status === 'PENDING') {
      // Must be at origin to dispatch/cancel (or global)
      actions.push({ label: 'Cancel', action: 'CANCEL' });
      actions.push({ label: 'Dispatch', action: 'DISPATCH' });
    } else if (transfer.status === 'IN_TRANSIT') {
      // Must be at destination to receive (or global)
      actions.push({ label: 'Receive', action: 'RECEIVE' });
    }
    return actions;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Transfers</h2>
          <p className="text-muted-foreground">
            Manage inter-branch inventory transfers.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsFormOpen(true)}>New Transfer</Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Status</TableHead>
              {canUpdate && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialTransfers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canUpdate ? 7 : 6}
                  className="text-muted-foreground py-8 text-center"
                >
                  No transfers found.
                </TableCell>
              </TableRow>
            ) : (
              initialTransfers.map((t) => {
                const actions = getAvailableActions(t);

                return (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{t.origin.name}</TableCell>
                    <TableCell>{t.destination.name}</TableCell>
                    <TableCell className="font-medium">
                      {t.product.sku}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {t.quantity}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          t.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : t.status === 'CANCELLED'
                              ? 'bg-gray-100 text-gray-800'
                              : t.status === 'IN_TRANSIT'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </TableCell>
                    {canUpdate && (
                      <TableCell className="space-x-2 text-right">
                        {actions.map((a) => (
                          <Button
                            key={a.action}
                            variant="outline"
                            size="sm"
                            onClick={() => setActionTransfer(t)}
                          >
                            Manage
                          </Button>
                        ))}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TransferFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        branches={branches}
        products={products}
        currentBranchId={currentBranchId}
      />

      {actionTransfer && (
        <TransferActionDialog
          transfer={actionTransfer}
          isOpen={true}
          onClose={() => setActionTransfer(null)}
        />
      )}
    </div>
  );
}
