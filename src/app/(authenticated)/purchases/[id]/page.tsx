import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guard';
import { getPurchaseOrder } from '@/lib/purchases/actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import PurchaseOrderActions from './actions';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    ORDERED: 'bg-blue-100 text-blue-800',
    PARTIALLY_RECEIVED: 'bg-yellow-100 text-yellow-800',
    RECEIVED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[status] || 'bg-gray-100 text-gray-800'}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('purchases:read');
  const { id } = await params;

  const result = await getPurchaseOrder(id);
  if (!result.success || !result.data) {
    notFound();
  }

  const po = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Purchase Order PO-{po.sequence.toString().padStart(5, '0')}
          </h2>
          <div className="mt-2 flex items-center space-x-4">
            <StatusBadge status={po.status} />
            <span className="text-muted-foreground text-sm">
              Supplier: {po.supplier.name}
            </span>
            <span className="text-muted-foreground text-sm">
              Created: {po.createdAt.toLocaleDateString()}
            </span>
          </div>
        </div>

        <PurchaseOrderActions po={po} />
      </div>

      <div className="bg-card text-card-foreground rounded-md border p-6">
        <h3 className="mb-4 text-lg font-semibold">Items</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Ordered Qty</TableHead>
              <TableHead className="text-right">Received Qty</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {po.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.sku}</TableCell>
                <TableCell>{item.productName}</TableCell>
                <TableCell className="text-right">
                  ${item.unitCost.toString()}
                </TableCell>
                <TableCell className="text-right">
                  {item.orderedQuantity}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={
                      item.receivedQuantity < item.orderedQuantity
                        ? 'font-medium text-yellow-600'
                        : 'font-medium text-green-600'
                    }
                  >
                    {item.receivedQuantity}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  ${item.subtotal.toString()}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={5} className="text-right font-bold">
                Total
              </TableCell>
              <TableCell className="text-right text-lg font-bold">
                ${po.total.toString()}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {po.notes && (
        <div className="bg-card text-card-foreground rounded-md border p-6">
          <h3 className="mb-2 text-lg font-semibold">Notes</h3>
          <p className="text-sm">{po.notes}</p>
        </div>
      )}
    </div>
  );
}
