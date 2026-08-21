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

export default async function StockPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  await requirePermission('inventory:read');

  // Super Admin and branch readers can see all, otherwise isolate to their branch
  const where =
    user.role.name === 'Super Admin' ||
    user.permissions.includes('branches:read')
      ? {}
      : { branchId: user.branchId };

  const stock = await prisma.branchStock.findMany({
    where,
    include: {
      product: true,
      branch: true,
    },
    orderBy: [{ branch: { name: 'asc' } }, { product: { name: 'asc' } }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Branch Stock</h2>
          <p className="text-muted-foreground">
            Current on-hand inventory balances.
          </p>
        </div>
        <Button>Adjust Stock</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">On Hand</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground text-center"
                >
                  No stock records found.
                </TableCell>
              </TableRow>
            ) : (
              stock.map((item) => (
                <TableRow key={`${item.branchId}-${item.productId}`}>
                  <TableCell>{item.branch.name}</TableCell>
                  <TableCell className="font-medium">
                    {item.product.sku}
                  </TableCell>
                  <TableCell>{item.product.name}</TableCell>
                  <TableCell className="text-right">{item.onHand}</TableCell>
                  <TableCell className="text-right">{item.reserved}</TableCell>
                  <TableCell className="text-right font-bold">
                    {item.onHand - item.reserved}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      Details
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
