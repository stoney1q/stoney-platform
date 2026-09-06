import { describe, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as assert from 'node:assert';
import { MovementType, Prisma } from '@/generated/prisma/client';

const { currentMockCookie } = vi.hoisted(() => ({
  currentMockCookie: { value: undefined as string | undefined },
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === 'stoney_session' && currentMockCookie.value !== undefined) {
        return { value: currentMockCookie.value };
      }
      return undefined;
    },
  }),
}));

vi.mock('../firebase/admin', () => ({
  isFirebaseAdminConfigured: () => true,
  getFirebaseAdminAuth: () => ({
    verifySessionCookie: async () => {
      if (currentMockCookie.value === 'active_manager') {
        return {
          uid: 'po_manager_uid',
          email: 'po_manager@test.com',
          email_verified: true,
        };
      }
      throw new Error('Invalid session cookie');
    },
  }),
}));

import prisma from '@/lib/prisma';
import {
  createPurchaseOrder,
  markPurchaseOrderOrdered,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from './actions';

describe('Purchases Actions', () => {
  let mainBranchId: string;
  let supplierId: string;
  let productId: string;
  let managerId: string;

  beforeAll(async () => {
    // Force cleanup from previous failed runs
    await prisma.stockMovement.deleteMany({
      where: { referenceId: { not: null } },
    });
    await prisma.purchaseOrderItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.productSupplier.deleteMany();
    await prisma.product.deleteMany({ where: { sku: 'PO-TEST-SKU-1' } });
    await prisma.supplier.deleteMany({ where: { name: 'PO Test Supplier' } });
    await prisma.user.deleteMany({ where: { firebaseUid: 'po_manager_uid' } });
    await prisma.role.deleteMany({ where: { name: 'Procurement Manager' } });

    // Ensure main branch exists
    const branch = await prisma.branch.findFirst({ where: { code: 'MAIN' } });
    assert.ok(branch, 'MAIN branch not found');
    mainBranchId = branch.id;

    // Find the manager user (who has all permissions in seed)
    const manager = await prisma.user.findFirst({
      where: { firebaseUid: 'po_manager_uid' },
    });
    if (manager) {
      managerId = manager.id;
    } else {
      // Create test manager if missing from global seed
      const newManager = await prisma.user.create({
        data: {
          firebaseUid: 'po_manager_uid',
          email: 'po_manager@test.com',
          firstName: 'PO Test',
          lastName: 'Manager',
          isActive: true,
          role: {
            connectOrCreate: {
              where: { name: 'Procurement Manager' },
              create: {
                name: 'Procurement Manager',
                rolePermissions: {
                  create: [
                    {
                      permission: {
                        connectOrCreate: {
                          where: { name: 'purchases:read' },
                          create: { name: 'purchases:read' },
                        },
                      },
                    },
                    {
                      permission: {
                        connectOrCreate: {
                          where: { name: 'purchases:write' },
                          create: { name: 'purchases:write' },
                        },
                      },
                    },
                    {
                      permission: {
                        connectOrCreate: {
                          where: { name: 'inventory:write' },
                          create: { name: 'inventory:write' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          branch: { connect: { id: mainBranchId } },
        },
      });
      managerId = newManager.id;
    }

    // Create supplier
    const supplier = await prisma.supplier.create({
      data: { name: 'PO Test Supplier' },
    });
    supplierId = supplier.id;

    // Create product
    const product = await prisma.product.create({
      data: {
        name: 'PO Test Product',
        sku: 'PO-TEST-SKU-1',
        description: 'Test Product for PO',
        sellingPrice: 10,
      },
    });
    productId = product.id;

    // Link product and supplier
    await prisma.productSupplier.create({
      data: {
        supplierId,
        productId,
        unitCost: 5,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.stockMovement.deleteMany({
      where: { referenceId: { not: null } },
    });
    await prisma.branchStock.deleteMany({
      where: { branchId: mainBranchId, productId },
    });
    await prisma.purchaseOrderItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.productSupplier.deleteMany();
    await prisma.product.deleteMany({ where: { sku: 'PO-TEST-SKU-1' } });
    await prisma.supplier.deleteMany({ where: { name: 'PO Test Supplier' } });
    await prisma.user.deleteMany({ where: { firebaseUid: 'po_manager_uid' } });
    await prisma.role.deleteMany({ where: { name: 'Procurement Manager' } });
  });

  beforeEach(() => {
    currentMockCookie.value = 'active_manager';
  });

  it('should successfully create a DRAFT purchase order', async () => {
    const res = await createPurchaseOrder({
      branchId: mainBranchId,
      supplierId,
      items: [{ productId, quantity: 10 }],
      notes: 'Test PO',
    });

    assert.ok(res.success, res.error);
    assert.ok(res.data);

    assert.strictEqual(res.data.status, 'DRAFT');
    assert.strictEqual(res.data.total.toNumber(), 50); // 10 qty * $5 unit cost
    assert.strictEqual(res.data.items.length, 1);
    assert.strictEqual(res.data.items[0].orderedQuantity, 10);
    assert.strictEqual(res.data.items[0].receivedQuantity, 0);
  });

  it('should transition DRAFT to ORDERED', async () => {
    const poRes = await createPurchaseOrder({
      branchId: mainBranchId,
      supplierId,
      items: [{ productId, quantity: 5 }],
    });
    assert.ok(poRes.success);

    const orderRes = await markPurchaseOrderOrdered(poRes.data!.id);
    assert.ok(orderRes.success);
    assert.strictEqual(orderRes.data!.status, 'ORDERED');
    assert.ok(orderRes.data!.orderedAt);
  });

  it('should receive partial quantities and update stock', async () => {
    const poRes = await createPurchaseOrder({
      branchId: mainBranchId,
      supplierId,
      items: [{ productId, quantity: 20 }],
    });
    assert.ok(poRes.success);
    const poId = poRes.data!.id;
    const itemId = poRes.data!.items[0].id;

    await markPurchaseOrderOrdered(poId);

    // Initial stock
    const initStock = await prisma.branchStock.findUnique({
      where: { branchId_productId: { branchId: mainBranchId, productId } },
    });
    const initOnHand = initStock ? initStock.onHand : 0;

    // Receive 5 items
    const receiveRes = await receivePurchaseOrder(poId, {
      items: [{ itemId, quantity: 5 }],
    });

    assert.ok(receiveRes.success, receiveRes.error);
    assert.strictEqual(receiveRes.data!.status, 'PARTIALLY_RECEIVED');

    // Verify PO Item update
    const updatedPoItem = await prisma.purchaseOrderItem.findUnique({
      where: { id: itemId },
    });
    assert.strictEqual(updatedPoItem!.receivedQuantity, 5);

    // Verify Stock Update
    const updatedStock = await prisma.branchStock.findUnique({
      where: { branchId_productId: { branchId: mainBranchId, productId } },
    });
    assert.strictEqual(updatedStock!.onHand, initOnHand + 5);

    // Verify Movement
    const movement = await prisma.stockMovement.findFirst({
      where: { referenceId: poId, productId },
    });
    assert.ok(movement);
    assert.strictEqual(movement.type, MovementType.RECEIPT);
    assert.strictEqual(movement.quantity, 5);
  });

  it('should prevent over-receiving', async () => {
    const poRes = await createPurchaseOrder({
      branchId: mainBranchId,
      supplierId,
      items: [{ productId, quantity: 2 }],
    });
    assert.ok(poRes.success);
    const poId = poRes.data!.id;
    const itemId = poRes.data!.items[0].id;

    await markPurchaseOrderOrdered(poId);

    // Try receiving 3
    const receiveRes = await receivePurchaseOrder(poId, {
      items: [{ itemId, quantity: 3 }],
    });

    assert.strictEqual(receiveRes.success, false);
    assert.ok(receiveRes.error?.includes('Cannot receive more than ordered'));
  });
  it('should allow cancellation of a DRAFT PO', async () => {
    const poRes = await createPurchaseOrder({
      branchId: mainBranchId,
      supplierId,
      items: [{ productId, quantity: 2 }],
    });
    const poId = poRes.data!.id;

    const cancelRes = await cancelPurchaseOrder(poId);
    assert.ok(cancelRes.success);
    assert.strictEqual(cancelRes.data!.status, 'CANCELLED');
  });

  it('should prevent cancellation of a PO with received quantities', async () => {
    const poRes = await createPurchaseOrder({
      branchId: mainBranchId,
      supplierId,
      items: [{ productId, quantity: 2 }],
    });
    const poId = poRes.data!.id;
    const itemId = poRes.data!.items[0].id;

    await markPurchaseOrderOrdered(poId);
    await receivePurchaseOrder(poId, { items: [{ itemId, quantity: 1 }] });

    const cancelRes = await cancelPurchaseOrder(poId);
    assert.strictEqual(cancelRes.success, false);
    assert.ok(
      cancelRes.error?.includes(
        'Cannot cancel a purchase order with received items'
      ) || cancelRes.error?.includes('Can only cancel DRAFT or ORDERED')
    );
  });

  it('should serialize concurrent receive and cancel operations', async () => {
    const poRes = await createPurchaseOrder({
      branchId: mainBranchId,
      supplierId,
      items: [{ productId, quantity: 10 }],
    });
    const poId = poRes.data!.id;
    const itemId = poRes.data!.items[0].id;

    await markPurchaseOrderOrdered(poId);

    // Run cancel and receive concurrently
    const [receiveRes, cancelRes] = await Promise.all([
      receivePurchaseOrder(poId, { items: [{ itemId, quantity: 5 }] }),
      cancelPurchaseOrder(poId),
    ]);

    // Either receive succeeded and cancel failed, or cancel succeeded and receive failed.
    // They cannot both succeed.
    const bothSucceeded = receiveRes.success && cancelRes.success;
    assert.strictEqual(
      bothSucceeded,
      false,
      'Concurrent receive and cancel should not both succeed'
    );

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });

    if (cancelRes.success) {
      assert.strictEqual(po!.status, 'CANCELLED');
      assert.strictEqual(po!.items[0].receivedQuantity, 0);
    } else {
      assert.strictEqual(po!.status, 'PARTIALLY_RECEIVED');
      assert.strictEqual(po!.items[0].receivedQuantity, 5);
      assert.ok(
        cancelRes.error?.includes(
          'Cannot cancel a purchase order with received items'
        ) || cancelRes.error?.includes('Can only cancel DRAFT or ORDERED')
      );
    }
  });

  it('should prevent a cancelled PO from receiving stock', async () => {
    const poRes = await createPurchaseOrder({
      branchId: mainBranchId,
      supplierId,
      items: [{ productId, quantity: 2 }],
    });
    const poId = poRes.data!.id;
    const itemId = poRes.data!.items[0].id;

    await cancelPurchaseOrder(poId);

    const receiveRes = await receivePurchaseOrder(poId, {
      items: [{ itemId, quantity: 1 }],
    });
    assert.strictEqual(receiveRes.success, false);
    assert.ok(
      receiveRes.error?.includes(
        'Can only receive items for ORDERED or PARTIALLY_RECEIVED purchase orders'
      )
    );
  });
});
