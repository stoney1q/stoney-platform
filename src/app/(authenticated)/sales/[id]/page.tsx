import { notFound } from 'next/navigation';
import { getSale } from '@/lib/sales/actions';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { SaleDetailsClient } from './sale-details-client';
import { SaleStatus, Product, BranchStock } from '@/generated/prisma/client';

export default async function SaleDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAuth(); // just to ensure logged in
  const sale = await getSale(params.id);

  if (!sale) {
    notFound();
  }

  // Get products for the "Add Item" dropdown (MVP)
  let availableProducts: (Product & { branchStocks: BranchStock[] })[] = [];
  if (sale.status === SaleStatus.PENDING) {
    availableProducts = await prisma.product.findMany({
      where: {
        branchStocks: {
          some: {
            branchId: sale.branchId,
          },
        },
      },
      orderBy: { name: 'asc' },
      include: {
        branchStocks: {
          where: { branchId: sale.branchId },
        },
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sale Details</h2>
        <p className="text-muted-foreground">
          View and manage sale {sale.id.slice(0, 8)}...
        </p>
      </div>

      <SaleDetailsClient sale={sale} availableProducts={availableProducts} />
    </div>
  );
}
