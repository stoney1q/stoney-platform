import { requirePermission, getCurrentUser } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { TransfersClient, TransferItem } from './transfers-client';

export default async function TransfersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  await requirePermission('transfers:read');

  const isGlobal =
    user.role.name === 'Super Admin' ||
    user.permissions.includes('admin:global');

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

  const canCreate = user.permissions.includes('transfers:write');
  const canUpdate = user.permissions.includes('transfers:write');

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const products = await prisma.product.findMany({
    select: { id: true, sku: true, name: true },
  });

  // Typecasting to match the client interface
  const formattedTransfers: TransferItem[] = transfers.map((t) => ({
    id: t.id,
    status: t.status,
    quantity: t.quantity,
    createdAt: t.createdAt,
    origin: { id: t.origin.id, name: t.origin.name },
    destination: { id: t.destination.id, name: t.destination.name },
    product: { id: t.product.id, sku: t.product.sku, name: t.product.name },
  }));

  return (
    <TransfersClient
      initialTransfers={formattedTransfers}
      canCreate={canCreate}
      canUpdate={canUpdate}
      branches={branches}
      products={products}
      currentBranchId={user.branchId || ''}
    />
  );
}
