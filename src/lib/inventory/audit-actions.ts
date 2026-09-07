'use server';

import prisma from '../prisma';
import {
  requireAuth,
  requireBranchAccess,
  requirePermission,
} from '../auth/guard';
import { StockAuditStatus, MovementType } from '../../generated/prisma/client';
import {
  createAuditSchema,
  updateAuditStatusSchema,
  upsertAuditItemSchema,
} from './audit-validation';

export async function createAudit(branchId: string, name?: string) {
  const user = await requireBranchAccess(branchId);
  await requirePermission('inventory:write');

  createAuditSchema.parse({ branchId, name });

  return await prisma.stockAudit.create({
    data: {
      branchId,
      name,
      createdById: user.id,
      status: StockAuditStatus.IN_PROGRESS,
    },
  });
}

export async function upsertAuditItem(
  auditId: string,
  productId: string,
  quantity: number,
  mode: 'set' | 'increment'
) {
  const user = await requireAuth();
  await requirePermission('inventory:write');
  upsertAuditItemSchema.parse({ auditId, productId, quantity, mode });

  const audit = await prisma.stockAudit.findUnique({ where: { id: auditId } });
  if (!audit) throw new Error('Audit not found');
  if (audit.status !== StockAuditStatus.IN_PROGRESS)
    throw new Error('Audit is not in progress');

  await requireBranchAccess(audit.branchId);

  return await prisma.$transaction(async (tx) => {
    const systemStock = await tx.branchStock.findUnique({
      where: { branchId_productId: { branchId: audit.branchId, productId } },
    });
    const systemQty = systemStock?.onHand ?? 0;

    return await tx.stockAuditItem.upsert({
      where: { stockAuditId_productId: { stockAuditId: auditId, productId } },
      update:
        mode === 'increment'
          ? { countedQuantity: { increment: quantity } }
          : { countedQuantity: quantity },
      create: {
        stockAuditId: auditId,
        productId,
        systemQuantity: systemQty,
        countedQuantity: quantity,
      },
    });
  });
}

export async function updateAuditStatus(
  auditId: string,
  status: StockAuditStatus
) {
  const user = await requireAuth();
  const audit = await prisma.stockAudit.findUnique({ where: { id: auditId } });
  if (!audit) throw new Error('Audit not found');

  await requireBranchAccess(audit.branchId);

  if (
    audit.status === StockAuditStatus.COMPLETED ||
    audit.status === StockAuditStatus.CANCELLED
  ) {
    throw new Error('Cannot change status of a terminal audit');
  }

  if (
    status === StockAuditStatus.REVIEW ||
    status === StockAuditStatus.CANCELLED
  ) {
    if (audit.status !== StockAuditStatus.IN_PROGRESS) {
      throw new Error(
        'Can only transition to REVIEW or CANCELLED from IN_PROGRESS'
      );
    }
  }

  if (status === StockAuditStatus.COMPLETED) {
    throw new Error('Use completeAudit action to complete an audit');
  }

  return await prisma.stockAudit.update({
    where: { id: auditId },
    data: { status },
  });
}

export async function completeAudit(auditId: string) {
  const user = await requireAuth();

  const auditHeader = await prisma.stockAudit.findUnique({
    where: { id: auditId },
  });
  if (!auditHeader) throw new Error('Audit not found');
  if (auditHeader.status !== StockAuditStatus.REVIEW)
    throw new Error('Audit must be in REVIEW status');

  await requireBranchAccess(auditHeader.branchId);
  await requirePermission('inventory:write');

  return await prisma.$transaction(
    async (tx) => {
      // Lock the audit to prevent concurrent completions
      const auditLocks = await tx.$queryRaw<{ status: StockAuditStatus }[]>`
      SELECT status FROM "StockAudit" WHERE id = ${auditId} FOR UPDATE
    `;
      if (
        auditLocks.length === 0 ||
        auditLocks[0].status !== StockAuditStatus.REVIEW
      ) {
        throw new Error('Audit must be in REVIEW status');
      }
      const audit = auditHeader;

      // Get all items sorted by productId to prevent deadlocks
      const items = await tx.stockAuditItem.findMany({
        where: { stockAuditId: auditId },
        orderBy: { productId: 'asc' },
      });

      for (const item of items) {
        // FOR UPDATE lock on the stock row
        const currentStock = await tx.$queryRaw<{ onHand: number }[]>`
        SELECT "onHand" FROM "BranchStock"
        WHERE "branchId" = ${audit.branchId} AND "productId" = ${item.productId}
        FOR UPDATE
      `;

        let currentOnHand = 0;
        if (currentStock.length === 0) {
          currentOnHand = 0;
        } else {
          currentOnHand = currentStock[0].onHand;
        }

        const variance = item.countedQuantity - currentOnHand;

        if (variance !== 0) {
          // Adjust stock
          await tx.branchStock.upsert({
            where: {
              branchId_productId: {
                branchId: audit.branchId,
                productId: item.productId,
              },
            },
            update: { onHand: item.countedQuantity },
            create: {
              branchId: audit.branchId,
              productId: item.productId,
              onHand: item.countedQuantity,
              reserved: 0,
            },
          });

          // Generate movement
          await tx.stockMovement.create({
            data: {
              branchId: audit.branchId,
              productId: item.productId,
              quantity: variance,
              type: MovementType.ADJUSTMENT,
              reason: `Audit Reconciled ${audit.sequence}`,
              referenceId: audit.id,
              userId: user.id,
            },
          });
        }

        // Record applied variance
        await tx.stockAuditItem.update({
          where: { id: item.id },
          data: { variance },
        });
      }

      return await tx.stockAudit.update({
        where: { id: auditId },
        data: {
          status: StockAuditStatus.COMPLETED,
          completedById: user.id,
          completedAt: new Date(),
        },
      });
    },
    {
      timeout: 10000,
    }
  );
}

export async function getAudits(branchId?: string) {
  const session = await requireAuth();
  await requirePermission('inventory:read');

  // Enforce branch isolation if not a global admin
  let queryBranchId = branchId;
  if (
    !session.permissions.includes('admin:global') &&
    session.role.name !== 'Super Admin'
  ) {
    queryBranchId = session.branchId;
  }

  return await prisma.stockAudit.findMany({
    where: {
      ...(queryBranchId ? { branchId: queryBranchId } : {}),
    },
    include: {
      branch: true,
      createdBy: true,
      completedBy: true,
      _count: {
        select: { items: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAuditById(auditId: string) {
  const session = await requireAuth();
  await requirePermission('inventory:read');

  const audit = await prisma.stockAudit.findUnique({
    where: { id: auditId },
    include: {
      branch: true,
      createdBy: true,
      completedBy: true,
      items: {
        include: {
          product: {
            include: {
              category: true,
              brand: true,
            },
          },
        },
        orderBy: {
          product: {
            name: 'asc',
          },
        },
      },
    },
  });

  if (!audit) return null;

  if (
    !session.permissions.includes('admin:global') &&
    session.role.name !== 'Super Admin'
  ) {
    if (audit.branchId !== session.branchId) {
      throw new Error(
        'Access denied. You do not have permission to view audits for this branch.'
      );
    }
  }

  return audit;
}
