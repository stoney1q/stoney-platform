'use server';

import prisma from '../prisma';
import {
  requireAuth,
  requireBranchAccess,
  requirePermission,
  requireGlobalAccess,
} from '../auth/guard';
import {
  MovementType,
  TransferStatus,
  ProductType,
  Prisma,
} from '../../generated/prisma/client';
import { storage } from '../media/storage';
import { receiveStockSchema, adjustStockSchema } from './validation';

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

/**
 * Receive stock into a branch (Positive increment)
 */
export async function receiveStock(
  branchId: string,
  productId: string,
  quantity: number,
  reason?: string,
  supplierId?: string
) {
  const user = await requireBranchAccess(branchId);
  await requirePermission('inventory:write');

  receiveStockSchema.parse({ branchId, productId, quantity, supplierId });

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error('Product not found');

  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) throw new Error('Supplier not found');
  }

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
        reason: reason || 'Direct stock receipt',
        referenceId: supplierId || null,
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

  adjustStockSchema.parse({ branchId, productId, quantity, reason });

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error('Product not found');

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

export async function deleteProduct(productId: string) {
  await requirePermission('inventory:write');

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { media: true },
  });
  if (!product) return;

  // Cleanup media in GCS
  for (const asset of product.media) {
    try {
      await storage.deleteObject(asset.path);
    } catch (e) {
      console.error('Failed to delete GCS object during product deletion:', e);
    }
  }

  // Prisma relation is Restrict, so we must manually delete MediaAsset records first
  return await prisma.$transaction(async (tx) => {
    await tx.mediaAsset.deleteMany({ where: { productId } });
    // This will fail if there are other Restrict relations (like BranchStock, StockMovement, etc)
    // Wait, are they Restrict? In the schema they are Cascade! (BranchStock, StockMovement, SaleItem, etc)
    // Only category/brand are Restrict (from product TO category).
    return await tx.product.delete({ where: { id: productId } });
  });
}

/**
 * AI Tool / Diagnostic Service
 * Fetches inventory items that are running low on stock or out of stock for a specific branch.
 */
export async function getLowStockItems(branchId: string, limit: number = 10) {
  // Ensure the user has the foundational permission
  await requirePermission('inventory:read');
  const session = await requireAuth();

  if (branchId === 'all') {
    await requireGlobalAccess(session);
  } else {
    // Ensure the user actually has access to this branch
    await requireBranchAccess(branchId);
  }

  // Prisma doesn't support comparing two fields (onHand <= reorderLevel) directly in the where clause
  // So we query the ids using raw sql, then fetch the full relations
  const rawResults = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "BranchStock"
    WHERE ${branchId === 'all' ? Prisma.empty : Prisma.sql`"branchId" = ${branchId} AND`} "onHand" <= "reorderLevel"
    LIMIT ${limit}
  `;

  if (rawResults.length === 0) return [];

  return await prisma.branchStock.findMany({
    where: {
      id: { in: rawResults.map((r) => r.id) },
    },
    include: {
      product: {
        include: {
          category: true,
          brand: true,
        },
      },
    },
  });
}
