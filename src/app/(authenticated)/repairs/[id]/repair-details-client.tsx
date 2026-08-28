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
  updateRepairStatus,
  assignTechnician,
  planRepairPart,
  consumeRepairPart,
  returnRepairPart,
  cancelRepair,
} from '@/lib/repairs/actions';
import { RepairMediaCard } from '@/components/media/repair-media-card';
import type {
  Customer,
  Device,
  Repair,
  RepairPart,
  RepairLog,
  User,
  Product,
  BranchStock,
} from '@/generated/prisma/client';

const REPAIR_STATUSES = [
  'RECEIVED',
  'DIAGNOSTIC',
  'QUOTED',
  'IN_PROGRESS',
  'COMPLETED',
  'DELIVERED',
  'CANCELLED',
];

type RepairPartWithProduct = RepairPart & {
  product: Product;
};

type RepairLogWithUser = RepairLog & {
  user: User;
};

type RepairWithRelations = Repair & {
  customer: Customer;
  device: Device;
  technician: User | null;
  parts: RepairPartWithProduct[];
  logs: RepairLogWithUser[];
};

type ProductWithStock = Product & {
  branchStocks: BranchStock[];
};

export function RepairDetailsClient({
  repair,
  availableProducts,
  technicians,
}: {
  repair: RepairWithRelations;
  availableProducts: ProductWithStock[];
  technicians: User[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const isFinalized =
    repair.status === 'COMPLETED' ||
    repair.status === 'DELIVERED' ||
    repair.status === 'CANCELLED';

  async function handleUpdateStatus(formData: FormData) {
    setError(null);
    setIsPending(true);
    formData.append('repairId', repair.id);
    formData.append('version', repair.version.toString());
    try {
      await updateRepairStatus(formData);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setIsPending(false);
    }
  }

  async function handleAssignTechnician(formData: FormData) {
    setError(null);
    setIsPending(true);
    formData.append('repairId', repair.id);
    formData.append('version', repair.version.toString());
    try {
      await assignTechnician(formData);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to assign technician');
    } finally {
      setIsPending(false);
    }
  }

  async function handlePlanPart(formData: FormData) {
    setError(null);
    setIsPending(true);
    formData.append('repairId', repair.id);
    formData.append('version', repair.version.toString());
    try {
      await planRepairPart(formData);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to plan part');
    } finally {
      setIsPending(false);
    }
  }

  async function handleConsumePart(productId: string, quantity: number) {
    setError(null);
    setIsPending(true);
    const formData = new FormData();
    formData.append('repairId', repair.id);
    formData.append('productId', productId);
    formData.append('quantity', quantity.toString());
    formData.append('version', repair.version.toString());
    try {
      await consumeRepairPart(formData);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to consume part');
    } finally {
      setIsPending(false);
    }
  }

  async function handleReturnPart(productId: string, quantity: number) {
    setError(null);
    setIsPending(true);
    const formData = new FormData();
    formData.append('repairId', repair.id);
    formData.append('productId', productId);
    formData.append('quantity', quantity.toString());
    formData.append('version', repair.version.toString());
    try {
      await returnRepairPart(formData);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to return part');
    } finally {
      setIsPending(false);
    }
  }

  async function handleCancelRepair() {
    if (!confirm('Are you sure you want to cancel this repair?')) return;
    setError(null);
    setIsPending(true);
    const formData = new FormData();
    formData.append('repairId', repair.id);
    formData.append('version', repair.version.toString());
    try {
      await cancelRepair(formData);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to cancel repair');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Info Card */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="mb-4 text-lg font-semibold">Repair Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-semibold">{repair.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer:</span>
              <span>
                {repair.customer.firstName} {repair.customer.lastName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Device:</span>
              <span>
                {repair.device.make} {repair.device.model}{' '}
                {repair.device.serialNumber &&
                  `(${repair.device.serialNumber})`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Issue:</span>
              <span>{repair.issue}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notes:</span>
              <span>{repair.notes || 'None'}</span>
            </div>
          </div>

          {!isFinalized && (
            <div className="mt-6 border-t pt-4">
              <form action={handleAssignTechnician} className="space-y-2">
                <label htmlFor="technicianId" className="text-sm font-medium">
                  Assign Technician
                </label>
                <div className="flex space-x-2">
                  <select
                    name="technicianId"
                    defaultValue={repair.technicianId || ''}
                    className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="submit"
                    disabled={isPending}
                    variant="secondary"
                  >
                    Assign
                  </Button>
                </div>
              </form>

              <form action={handleUpdateStatus} className="mt-4 space-y-2">
                <label htmlFor="status" className="text-sm font-medium">
                  Update Status
                </label>
                <div className="space-y-2">
                  <select
                    name="status"
                    defaultValue={repair.status}
                    className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                  >
                    {REPAIR_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    name="notes"
                    placeholder="Optional update note"
                    className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                  />
                  <Button type="submit" disabled={isPending} className="w-full">
                    Update Status
                  </Button>
                </div>
              </form>

              <div className="mt-4 border-t pt-4">
                <Button
                  onClick={handleCancelRepair}
                  variant="destructive"
                  className="w-full"
                  disabled={isPending}
                >
                  Cancel Repair
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Parts Management */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="mb-4 text-lg font-semibold">Parts Management</h3>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Ret</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repair.parts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground text-center"
                  >
                    No parts planned or used.
                  </TableCell>
                </TableRow>
              ) : (
                repair.parts.map((part) => {
                  const netConsumed =
                    part.consumedQuantity - part.returnedQuantity;
                  return (
                    <TableRow key={part.id}>
                      <TableCell className="font-medium">
                        {part.product.name}
                      </TableCell>
                      <TableCell>{part.plannedQuantity}</TableCell>
                      <TableCell>{part.consumedQuantity}</TableCell>
                      <TableCell>{part.returnedQuantity}</TableCell>
                      <TableCell className="space-x-1 text-right">
                        {!isFinalized && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleConsumePart(part.productId, 1)
                              }
                              disabled={isPending}
                            >
                              Use 1
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleReturnPart(part.productId, 1)
                              }
                              disabled={isPending || netConsumed <= 0}
                            >
                              Ret 1
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {!isFinalized && availableProducts.length > 0 && (
            <form
              action={handlePlanPart}
              className="mt-4 space-y-2 border-t pt-4"
            >
              <label className="text-sm font-medium">Plan Part</label>
              <div className="flex space-x-2">
                <select
                  name="productId"
                  required
                  className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                >
                  <option value="" disabled>
                    Select a product...
                  </option>
                  {availableProducts.map((p) => {
                    const stock = p.branchStocks[0];
                    const available = stock ? stock.onHand - stock.reserved : 0;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {available})
                      </option>
                    );
                  })}
                </select>
                <input
                  type="number"
                  name="plannedQuantity"
                  required
                  min="1"
                  defaultValue="1"
                  className="border-input focus-visible:ring-ring flex h-9 w-20 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                />
                <Button type="submit" disabled={isPending} variant="secondary">
                  Add
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Logs Card */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="mb-4 text-lg font-semibold">Repair History</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>State Change</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {repair.logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{log.createdAt.toLocaleString()}</TableCell>
                <TableCell>
                  {log.user.firstName} {log.user.lastName}
                </TableCell>
                <TableCell>
                  {log.previousState ? `${log.previousState} ➔ ` : ''}
                  <span className="font-semibold">{log.newState}</span>
                </TableCell>
                <TableCell>{log.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Media Card */}
      <RepairMediaCard repairId={repair.id} isFinalized={isFinalized} />
    </div>
  );
}
