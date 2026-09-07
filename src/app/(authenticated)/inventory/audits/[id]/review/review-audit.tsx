'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  completeAudit,
  updateAuditStatus,
} from '@/lib/inventory/audit-actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function ReviewAuditInterface({ audit }: { audit: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    if (
      !confirm(
        'Are you sure you want to complete this audit? This will immediately apply all variances to live stock and create stock movements.'
      )
    )
      return;
    setLoading(true);
    try {
      await completeAudit(audit.id);
      router.refresh();
    } catch (e: any) {
      alert(e.message || 'Failed to complete audit');
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (
      !confirm(
        'Are you sure you want to cancel this audit? This cannot be undone.'
      )
    )
      return;
    setLoading(true);
    try {
      await updateAuditStatus(audit.id, 'CANCELLED');
      router.push('/inventory/audits');
    } catch (e: any) {
      alert(e.message || 'Failed to cancel audit');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Counted Items</h3>
            {audit.status === 'REVIEW' && (
              <div className="space-x-2">
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancel Audit
                </Button>
                <Button onClick={handleComplete} disabled={loading}>
                  {loading ? 'Completing...' : 'Approve & Reconcile'}
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">System Snapshot</TableHead>
                  <TableHead className="text-right">Counted</TableHead>
                  <TableHead className="text-right">
                    Expected Variance
                  </TableHead>
                  {audit.status === 'COMPLETED' && (
                    <TableHead className="text-right">
                      Applied Variance
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.items.map((item: any) => {
                  const expectedVariance =
                    item.countedQuantity - item.systemQuantity;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.product.sku}
                      </TableCell>
                      <TableCell>{item.product.name}</TableCell>
                      <TableCell className="text-right">
                        {item.systemQuantity}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {item.countedQuantity}
                      </TableCell>
                      <TableCell
                        className={`text-right ${expectedVariance < 0 ? 'font-medium text-red-500' : expectedVariance > 0 ? 'font-medium text-green-500' : 'text-muted-foreground'}`}
                      >
                        {expectedVariance > 0 ? '+' : ''}
                        {expectedVariance}
                      </TableCell>
                      {audit.status === 'COMPLETED' && (
                        <TableCell
                          className={`text-right font-bold ${item.variance < 0 ? 'text-red-500' : item.variance > 0 ? 'text-green-500' : 'text-muted-foreground'}`}
                        >
                          {item.variance > 0 ? '+' : ''}
                          {item.variance}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {audit.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground py-8 text-center"
                    >
                      No items were counted in this audit.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {audit.status === 'REVIEW' && (
            <p className="text-muted-foreground mt-4 text-xs">
              * The "Expected Variance" is based on the system snapshot at the
              time the audit was created. The actual applied variance will be
              calculated exactly at the moment of approval against live stock to
              account for any concurrent sales or receipts.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
