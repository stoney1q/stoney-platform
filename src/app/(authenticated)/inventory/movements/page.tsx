import { requirePermission, getCurrentUser } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { redirect } from 'next/navigation';

export default async function MovementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  await requirePermission('inventory:read');

  const where =
    user.role.name === 'Super Admin' ||
    user.permissions.includes('admin:global')
      ? {}
      : { branchId: user.branchId };

  const movements = await prisma.stockMovement.findMany({
    where,
    include: {
      product: true,
      branch: true,
      user: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100, // limit for MVP
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Stock Movements Ledger
          </h2>
          <p className="text-muted-foreground">
            Immutable audit trail of all inventory changes.
          </p>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Reason / Ref</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground text-center"
                >
                  No stock movements found.
                </TableCell>
              </TableRow>
            ) : (
              movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap">
                    {m.createdAt.toLocaleString()}
                  </TableCell>
                  <TableCell>{m.branch.name}</TableCell>
                  <TableCell className="font-medium">{m.product.sku}</TableCell>
                  <TableCell>{m.type}</TableCell>
                  <TableCell
                    className={`text-right font-bold ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {m.quantity > 0 ? '+' : ''}
                    {m.quantity}
                  </TableCell>
                  <TableCell>
                    {m.user.firstName} {m.user.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {m.reason || m.referenceId || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
