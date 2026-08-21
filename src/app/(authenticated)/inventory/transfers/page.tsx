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
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';

export default async function TransfersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  await requirePermission('transfers:read');

  const isGlobal =
    user.role.name === 'Super Admin' ||
    user.permissions.includes('branches:read');

  const where = isGlobal
    ? {}
    : {
        OR: [{ originId: user.branchId }, { destinationId: user.branchId }],
      };

  const transfers = await prisma.transfer.findMany({
    where,
    include: {
      product: true,
      origin: true,
      destination: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Transfers</h2>
          <p className="text-muted-foreground">
            Manage inter-branch inventory transfers.
          </p>
        </div>
        <Button>New Transfer</Button>
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground text-center"
                >
                  No transfers found.
                </TableCell>
              </TableRow>
            ) : (
              transfers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap">
                    {t.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell>{t.origin.name}</TableCell>
                  <TableCell>{t.destination.name}</TableCell>
                  <TableCell className="font-medium">{t.product.sku}</TableCell>
                  <TableCell className="text-right font-bold">
                    {t.quantity}
                  </TableCell>
                  <TableCell>{t.status}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      Manage
                    </Button>
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
