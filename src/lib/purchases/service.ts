import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { applyStockReceipt } from '@/lib/inventory/actions';
import {
  CreatePurchaseOrderValues,
  ReceivePurchaseOrderValues,
  UpdatePurchaseOrderValues,
} from './validation';

export async function getPurchaseOrders(
  branchId: string,
  page = 1,
  limit = 50
) {
  const skip = (page - 1) * limit;

  const [total, purchaseOrders] = await Promise.all([
    prisma.purchaseOrder.count({ where: { branchId } }),
    prisma.purchaseOrder.findMany({
      where: { branchId },
      include: {
        supplier: true,
        createdBy: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return { purchaseOrders, total, pages: Math.ceil(total / limit) };
}

export async function getPurchaseOrder(id: string) {
  return await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: true,
      supplier: true,
      createdBy: true,
    },
  });
}

export async function createPurchaseOrder(
  userId: string,
  data: CreatePurchaseOrderValues
) {
  // Get supplier products to find cost
  const productSuppliers = await prisma.productSupplier.findMany({
    where: {
      supplierId: data.supplierId,
      productId: { in: data.items.map((i) => i.productId) },
    },
    include: { product: true },
  });

  const productMap = new Map(productSuppliers.map((ps) => [ps.productId, ps]));

  // Calculate totals
  let total = new Prisma.Decimal(0);
  const itemsData = data.items.map((item) => {
    const ps = productMap.get(item.productId);
    if (!ps) {
      throw new Error(
        `Product ${item.productId} is not mapped to Supplier ${data.supplierId}`
      );
    }

    const subtotal = ps.unitCost.mul(item.quantity);
    total = total.add(subtotal);

    return {
      productId: item.productId,
      sku: ps.product.sku,
      productName: ps.product.name,
      orderedQuantity: item.quantity,
      unitCost: ps.unitCost,
      subtotal,
    };
  });

  return await prisma.purchaseOrder.create({
    data: {
      branchId: data.branchId,
      supplierId: data.supplierId,
      createdById: userId,
      status: 'DRAFT',
      total,
      notes: data.notes,
      items: {
        create: itemsData,
      },
    },
    include: {
      items: true,
      supplier: true,
    },
  });
}

export async function markPurchaseOrderOrdered(id: string) {
  return await prisma.$transaction(async (tx) => {
    const lockedPo = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "PurchaseOrder" WHERE id = ${id} FOR UPDATE
    `;
    if (lockedPo.length === 0) throw new Error('Purchase Order not found');

    const po = await tx.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new Error('Purchase Order not found');
    if (po.status !== 'DRAFT')
      throw new Error('Only DRAFT purchase orders can be ordered');

    return await tx.purchaseOrder.update({
      where: { id },
      data: {
        status: 'ORDERED',
        orderedAt: new Date(),
      },
    });
  });
}

export async function cancelPurchaseOrder(id: string) {
  return await prisma.$transaction(async (tx) => {
    const lockedPo = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "PurchaseOrder" WHERE id = ${id} FOR UPDATE
    `;
    if (lockedPo.length === 0) throw new Error('Purchase Order not found');

    const po = await tx.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!po) throw new Error('Purchase Order not found');
    if (po.status !== 'DRAFT' && po.status !== 'ORDERED') {
      throw new Error('Can only cancel DRAFT or ORDERED purchase orders');
    }

    const hasReceived = po.items.some((i) => i.receivedQuantity > 0);
    if (hasReceived) {
      throw new Error('Cannot cancel a purchase order with received items');
    }

    return await tx.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  });
}

export async function receivePurchaseOrder(
  id: string,
  userId: string,
  data: ReceivePurchaseOrderValues
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Lock the Purchase Order
    const lockedPo = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "PurchaseOrder" WHERE id = ${id} FOR UPDATE
    `;
    if (lockedPo.length === 0) throw new Error('Purchase Order not found');

    const po = await tx.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!po) throw new Error('Purchase Order not found');

    if (po.status !== 'ORDERED' && po.status !== 'PARTIALLY_RECEIVED') {
      throw new Error(
        'Can only receive items for ORDERED or PARTIALLY_RECEIVED purchase orders'
      );
    }

    // 2. Process each item receipt
    const itemMap = new Map(po.items.map((i) => [i.id, i]));
    const receiveMap = new Map<string, number>();

    // Consolidate received quantities in case of duplicates in payload
    for (const rItem of data.items) {
      const current = receiveMap.get(rItem.itemId) || 0;
      receiveMap.set(rItem.itemId, current + rItem.quantity);
    }

    for (const [itemId, incomingQty] of Array.from(receiveMap.entries())) {
      const poItem = itemMap.get(itemId);
      if (!poItem)
        throw new Error(`PO Item ${itemId} not found in this Purchase Order`);

      const newReceivedQty = poItem.receivedQuantity + incomingQty;
      if (newReceivedQty > poItem.orderedQuantity) {
        throw new Error(
          `Cannot receive more than ordered for item ${poItem.sku}. Ordered: ${poItem.orderedQuantity}, Previously Received: ${poItem.receivedQuantity}, Attempting to Receive: ${incomingQty}`
        );
      }

      // Update PO Item
      await tx.purchaseOrderItem.update({
        where: { id: itemId },
        data: { receivedQuantity: newReceivedQty },
      });

      // Update Branch Stock & Create Movement
      await applyStockReceipt(tx, {
        branchId: po.branchId,
        productId: poItem.productId,
        quantity: incomingQty,
        userId: userId,
        reason: `Receipt against PO #${po.sequence}`,
        referenceId: po.id,
      });
    }

    // 3. Determine new PO status
    // Refetch items to get updated receivedQuantity
    const updatedItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: po.id },
    });

    const isFullyReceived = updatedItems.every(
      (item) => item.receivedQuantity === item.orderedQuantity
    );

    const newStatus = isFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    const receivedAt = isFullyReceived ? new Date() : po.receivedAt;

    return await tx.purchaseOrder.update({
      where: { id },
      data: {
        status: newStatus,
        receivedAt,
      },
      include: { items: true, supplier: true },
    });
  });
}
