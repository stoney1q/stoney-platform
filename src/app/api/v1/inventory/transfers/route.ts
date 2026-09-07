import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { requireAuth, requirePermission } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { TransferStatus } from '@/generated/prisma/client';

export const GET = apiHandler(async () => {
  const session = await requireAuth();
  await requirePermission('inventory:read');

  const isAdmin =
    session.permissions.includes('admin:global') ||
    session.role.name === 'Super Admin';
  const branchId = isAdmin ? undefined : session.branchId;

  // Find incoming (in-transit) and outgoing (pending) transfers for this branch
  const transfers = await prisma.transfer.findMany({
    where: {
      OR: [
        {
          ...(branchId ? { originId: branchId } : {}),
          status: TransferStatus.PENDING,
        },
        {
          ...(branchId ? { destinationId: branchId } : {}),
          status: TransferStatus.IN_TRANSIT,
        },
      ],
    },
    include: {
      origin: true,
      destination: true,
      product: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const outgoing = transfers.filter((t) => t.status === TransferStatus.PENDING);
  const incoming = transfers.filter(
    (t) => t.status === TransferStatus.IN_TRANSIT
  );

  return NextResponse.json({
    data: {
      outgoing,
      incoming,
    },
  });
});
