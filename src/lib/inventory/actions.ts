'use server';

import prisma from '../prisma';
import {
  requireAuth,
  requireBranchAccess,
  requirePermission,
} from '../auth/guard';
import {
  MovementType,
  TransferStatus,
  ProductType,
} from '../../generated/prisma/client';

/**
 * Validates product SKU uniqueness
 */
export async function createProduct(data: {
  sku: string;
  name: string;
  description?: string;
  sellingPrice?: number;
  type?: ProductType;
  categoryId?: string | null;
  brandId?: string | null;
}) {
  await requirePermission('inventory:write');

  const existing = await prisma.product.findUnique({
    where: { sku: data.sku },
  });
  if (existing) {
    throw new Error(`Product with SKU ${data.sku} already exists`);
  }

  return await prisma.product.create({
    data: {
      ...data,
      // Prisma expects undefined for omitted optional fields, but if someone passes empty string, convert to null
      categoryId: data.categoryId || null,
      brandId: data.brandId || null,
    },
  });
}

export async function updateProduct(
  id: string,
  data: {
    name?: string;
    description?: string;
    categoryId?: string | null;
    brandId?: string | null;
  }
) {
  await requirePermission('inventory:write');

  return await prisma.product.update({
    where: { id },
    data: {
      ...data,
      categoryId: data.categoryId === '' ? null : data.categoryId,
      brandId: data.brandId === '' ? null : data.brandId,
    },
  });
}

export async function createSupplier(data: {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
}) {
  await requirePermission('inventory:write');

  return await prisma.supplier.create({
    data,
  });
}

export async function updateSupplier(
  id: string,
  data: { name?: string; contactName?: string; email?: string; phone?: string }
) {
  await requirePermission('inventory:write');

  return await prisma.supplier.update({
    where: { id },
    data,
  });
}

export async function linkProductSupplier(data: {
  productId: string;
  supplierId: string;
  supplierSku?: string;
  unitCost: number;
  isPreferred?: boolean;
}) {
  await requirePermission('inventory:write');

  return await prisma.productSupplier.create({
    data,
  });
}

/**
 * Receive stock into a branch (Positive increment)
 */
export async function receiveStock(
  branchId: string,
  productId: string,
  quantity: number,
  reason?: string
) {
  const user = await requireBranchAccess(branchId);
  await requirePermission('inventory:write');

  if (quantity <= 0) throw new Error('Quantity must be greater than zero');

  return await prisma.$transaction(async (tx) => {
    // Upsert the BranchStock
    const stock = await tx.branchStock.upsert({
      where: { branchId_productId: { branchId, productId } },
      update: { onHand: { increment: quantity } },
      create: { branchId, productId, onHand: quantity, reserved: 0 },
    });

    // Create movement
    await tx.stockMovement.create({
      data: {
        branchId,
        productId,
        quantity,
        type: MovementType.RECEIPT,
        userId: user.id,
        reason,
      },
    });

    return stock;
  });
}

/**
 * Adjust stock in a branch (Positive or Negative)
 */
export async function adjustStock(
  branchId: string,
  productId: string,
  quantity: number,
  reason: string
) {
  const user = await requireBranchAccess(branchId);
  await requirePermission('inventory:write');

  if (quantity === 0) throw new Error('Quantity cannot be zero');
  if (!reason) throw new Error('Reason is required for adjustments');

  return await prisma.$transaction(async (tx) => {
    if (quantity > 0) {
      const stock = await tx.branchStock.upsert({
        where: { branchId_productId: { branchId, productId } },
        update: { onHand: { increment: quantity } },
        create: { branchId, productId, onHand: quantity, reserved: 0 },
      });

      await tx.stockMovement.create({
        data: {
          branchId,
          productId,
          quantity,
          type: MovementType.ADJUSTMENT,
          userId: user.id,
          reason,
        },
      });
      return stock;
    } else {
      // Negative adjustment requires conditional update
      const absQty = Math.abs(quantity);

      // Raw SQL conditional update
      const count = await tx.$executeRaw`
        UPDATE "BranchStock"
        SET "onHand" = "onHand" - ${absQty}
        WHERE "branchId" = ${branchId}
          AND "productId" = ${productId}
          AND ("onHand" - "reserved") >= ${absQty}
      `;

      if (count !== 1) {
        throw new Error(
          'Insufficient available stock or record not found for negative adjustment'
        );
      }

      await tx.stockMovement.create({
        data: {
          branchId,
          productId,
          quantity, // Negative
          type: MovementType.ADJUSTMENT,
          userId: user.id,
          reason,
        },
      });

      return await tx.branchStock.findUnique({
        where: { branchId_productId: { branchId, productId } },
      });
    }
  });
}

/**
 * Create a new inter-branch transfer
 */
export async function createTransfer(
  originId: string,
  destinationId: string,
  productId: string,
  quantity: number
) {
  const user = await requireBranchAccess(originId);
  await requirePermission('transfers:write');

  if (originId === destinationId)
    throw new Error('Origin and destination cannot be the same');
  if (quantity <= 0) throw new Error('Quantity must be greater than zero');

  // Verify destination exists
  const dest = await prisma.branch.findUnique({ where: { id: destinationId } });
  if (!dest) throw new Error('Destination branch not found');

  return await prisma.transfer.create({
    data: {
      originId,
      destinationId,
      productId,
      quantity,
      status: TransferStatus.PENDING,
      createdById: user.id,
    },
  });
}

/**
 * Dispatch an existing pending transfer
 */
export async function dispatchTransfer(transferId: string) {
  const user = await requireAuth();
  await requirePermission('transfers:write');

  return await prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.findUnique({
      where: { id: transferId },
    });
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.status !== TransferStatus.PENDING)
      throw new Error('Transfer is not PENDING');

    // Verify origin access
    if (
      user.role.name !== 'Super Admin' &&
      !user.permissions.includes('admin:global') &&
      user.branchId !== transfer.originId
    ) {
      throw new Error(
        'Access denied. You do not have permission to dispatch from this origin branch.'
      );
    }

    // Decrement stock conditionally
    const count = await tx.$executeRaw`
      UPDATE "BranchStock"
      SET "onHand" = "onHand" - ${transfer.quantity}
      WHERE "branchId" = ${transfer.originId}
        AND "productId" = ${transfer.productId}
        AND ("onHand" - "reserved") >= ${transfer.quantity}
    `;

    if (count !== 1) {
      throw new Error(
        'Insufficient available stock at origin to dispatch transfer'
      );
    }

    // Create Movement OUT
    await tx.stockMovement.create({
      data: {
        branchId: transfer.originId,
        productId: transfer.productId,
        quantity: -transfer.quantity,
        type: MovementType.TRANSFER_OUT,
        referenceId: transfer.id,
        userId: user.id,
      },
    });

    // Update Transfer
    return await tx.transfer.update({
      where: { id: transfer.id },
      data: { status: TransferStatus.IN_TRANSIT },
    });
  });
}

/**
 * Receive an in-transit transfer at destination
 */
export async function receiveTransfer(transferId: string) {
  const user = await requireAuth();
  await requirePermission('transfers:write');

  return await prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.findUnique({
      where: { id: transferId },
    });
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.status !== TransferStatus.IN_TRANSIT)
      throw new Error('Transfer is not IN_TRANSIT');

    // Verify destination access
    if (
      user.role.name !== 'Super Admin' &&
      !user.permissions.includes('admin:global') &&
      user.branchId !== transfer.destinationId
    ) {
      throw new Error(
        'Access denied. You do not have permission to receive at this destination branch.'
      );
    }

    // Increment stock
    await tx.branchStock.upsert({
      where: {
        branchId_productId: {
          branchId: transfer.destinationId,
          productId: transfer.productId,
        },
      },
      update: { onHand: { increment: transfer.quantity } },
      create: {
        branchId: transfer.destinationId,
        productId: transfer.productId,
        onHand: transfer.quantity,
        reserved: 0,
      },
    });

    // Create Movement IN
    await tx.stockMovement.create({
      data: {
        branchId: transfer.destinationId,
        productId: transfer.productId,
        quantity: transfer.quantity,
        type: MovementType.TRANSFER_IN,
        referenceId: transfer.id,
        userId: user.id,
      },
    });

    // Update Transfer
    return await tx.transfer.update({
      where: { id: transfer.id },
      data: { status: TransferStatus.COMPLETED },
    });
  });
}

/**
 * Cancel a pending transfer
 */
export async function cancelTransfer(transferId: string) {
  const user = await requireAuth();
  await requirePermission('transfers:write');

  return await prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.findUnique({
      where: { id: transferId },
    });
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.status !== TransferStatus.PENDING)
      throw new Error('Only PENDING transfers can be cancelled');

    // Verify origin access
    if (
      user.role.name !== 'Super Admin' &&
      !user.permissions.includes('admin:global') &&
      user.branchId !== transfer.originId
    ) {
      throw new Error(
        'Access denied. You do not have permission to cancel from this origin branch.'
      );
    }

    // Update Transfer
    return await tx.transfer.update({
      where: { id: transfer.id },
      data: { status: TransferStatus.CANCELLED },
    });
  });
}
