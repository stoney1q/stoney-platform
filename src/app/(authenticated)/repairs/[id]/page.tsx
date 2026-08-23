import { notFound } from 'next/navigation';
import { getRepairById } from '@/lib/repairs/actions';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { RepairDetailsClient } from './repair-details-client';
import { RepairStatus, Product, BranchStock } from '@/generated/prisma/client';

export default async function RepairDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAuth();
  const repair = await getRepairById(params.id);

  if (!repair) {
    notFound();
  }

  let availableProducts: (Product & { branchStocks: BranchStock[] })[] = [];
  if (
    repair.status !== RepairStatus.COMPLETED &&
    repair.status !== RepairStatus.DELIVERED &&
    repair.status !== RepairStatus.CANCELLED
  ) {
    availableProducts = await prisma.product.findMany({
      where: {
        branchStocks: {
          some: {
            branchId: repair.branchId,
          },
        },
      },
      orderBy: { name: 'asc' },
      include: {
        branchStocks: {
          where: { branchId: repair.branchId },
        },
      },
    });
  }

  const technicians = await prisma.user.findMany({
    where: {
      branchId: repair.branchId,
      // In a real app we might filter by a specific "TECHNICIAN" role
    },
    orderBy: { firstName: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Repair Details</h2>
        <p className="text-muted-foreground">
          View and manage repair {repair.id.slice(0, 8)}...
        </p>
      </div>

      <RepairDetailsClient
        repair={repair}
        availableProducts={availableProducts}
        technicians={technicians}
      />
    </div>
  );
}
