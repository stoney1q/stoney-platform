import { describe, it, beforeAll, afterAll, vi } from 'vitest';
import assert from 'node:assert';
import 'dotenv/config';

// Mock cookies based on a simple global state we can change per test
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
      if (currentMockCookie.value === 'active_hq_user') {
        return { uid: 'hq_uid', email: 'hq@test.local' };
      }
      if (currentMockCookie.value === 'active_other_user') {
        return { uid: 'other_uid', email: 'other@test.local' };
      }
      throw new Error('auth/invalid-session-cookie');
    },
  }),
}));

describe('Inventory Actions & Security', async () => {
  const prisma = (await import('../prisma')).default;
  const {
    receiveStock,
    adjustStock,
    createTransfer,
    dispatchTransfer,
    receiveTransfer,
    cancelTransfer,
  } = await import('./actions');

  let branchHQ: { id: string };
  let branchOther: { id: string };
  let productA: { id: string };

  beforeAll(async () => {
    // 1. Setup branches
    branchHQ = await prisma.branch.upsert({
      where: { code: 'HQ' },
      update: {},
      create: { name: 'Head Office', code: 'HQ' },
    });
    branchOther = await prisma.branch.upsert({
      where: { code: 'OTHER' },
      update: {},
      create: { name: 'Other Branch', code: 'OTHER' },
    });

    const roleManager = await prisma.role.upsert({
      where: { name: 'Branch Manager' },
      update: {},
      create: { name: 'Branch Manager' },
    });

    const requiredPermissions = [
      'inventory:write',
      'transfers:write',
      'inventory:read',
      'transfers:read',
    ];
    for (const p of requiredPermissions) {
      const perm = await prisma.permission.upsert({
        where: { name: p },
        update: {},
        create: { name: p, description: p },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleManager.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: { roleId: roleManager.id, permissionId: perm.id },
      });
    }

    // Clean users
    await prisma.stockMovement.deleteMany();
    await prisma.repairLog.deleteMany();
    await prisma.repairPart.deleteMany();
    await prisma.repair.updateMany({ data: { activeQuotationId: null } });
    await prisma.quotation.updateMany({ data: { repairId: null } });
    await prisma.quotationItem.deleteMany({});
    await prisma.quotation.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.saleItem.deleteMany({});
    await prisma.sale.deleteMany({});
    await prisma.repair.deleteMany();
    await prisma.device.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@test.local' } },
    });

    await prisma.user.create({
      data: {
        firstName: 'HQ',
        lastName: 'User',
        email: 'hq@test.local',
        firebaseUid: 'hq_uid',
        isActive: true,
        emailVerified: true,
        branchId: branchHQ.id,
        roleId: roleManager.id,
      },
    });

    await prisma.user.create({
      data: {
        firstName: 'Other',
        lastName: 'User',
        email: 'other@test.local',
        firebaseUid: 'other_uid',
        isActive: true,
        emailVerified: true,
        branchId: branchOther.id,
        roleId: roleManager.id,
      },
    });

    // Setup product
    await prisma.product.deleteMany({ where: { sku: 'TEST-SKU-1' } });
    productA = await prisma.product.create({
      data: { sku: 'TEST-SKU-1', name: 'Test Product 1' },
    });

    // Clean stock and transfers
    await prisma.stockMovement.deleteMany({});
    await prisma.transfer.deleteMany({});
    await prisma.branchStock.deleteMany({});
  });

  afterAll(async () => {
    // Cleanup
    await prisma.stockMovement.deleteMany({});
    await prisma.transfer.deleteMany({});
    await prisma.branchStock.deleteMany({});
    await prisma.product.deleteMany({ where: { sku: 'TEST-SKU-1' } });
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@test.local' } },
    });
    await prisma.$disconnect();
  });

  describe('receiveStock', () => {
    it('creates branch stock and movement', async () => {
      currentMockCookie.value = 'active_hq_user';
      const stock = await receiveStock(
        branchHQ.id,
        productA.id,
        50,
        'Initial setup'
      );
      assert.strictEqual(stock.onHand, 50);

      const movements = await prisma.stockMovement.findMany({
        where: { branchId: branchHQ.id, productId: productA.id },
      });
      assert.strictEqual(movements.length, 1);
      assert.strictEqual(movements[0].quantity, 50);
      assert.strictEqual(movements[0].type, 'RECEIPT');
    });

    it('rejects access for wrong branch', async () => {
      currentMockCookie.value = 'active_other_user';
      await assert.rejects(
        receiveStock(branchHQ.id, productA.id, 10),
        (err: Error) => err.message.includes('Access denied')
      );
    });
  });

  describe('adjustStock', () => {
    it('allows positive adjustment', async () => {
      currentMockCookie.value = 'active_hq_user';
      const stock = await adjustStock(
        branchHQ.id,
        productA.id,
        10,
        'Found extra'
      );
      assert.ok(stock);
      assert.strictEqual(stock.onHand, 60);
    });

    it('allows negative adjustment when sufficient stock', async () => {
      currentMockCookie.value = 'active_hq_user';
      const stock = await adjustStock(branchHQ.id, productA.id, -20, 'Damaged');
      assert.ok(stock);
      assert.strictEqual(stock.onHand, 40);
    });

    it('rejects negative adjustment when insufficient stock', async () => {
      currentMockCookie.value = 'active_hq_user';
      await assert.rejects(
        adjustStock(branchHQ.id, productA.id, -100, 'Too much'),
        (err: Error) => err.message.includes('Insufficient available stock')
      );
    });

    it('prevents negative stock under concurrent consumption', async () => {
      currentMockCookie.value = 'active_hq_user';

      // Get current stock, should be 40
      const current = await prisma.branchStock.findUnique({
        where: {
          branchId_productId: { branchId: branchHQ.id, productId: productA.id },
        },
      });
      assert.ok(current);

      // Try to consume more than available concurrently
      const consume = Math.floor(current.onHand / 2) + 1; // e.g., if 40, consume 21

      const promises = [
        adjustStock(branchHQ.id, productA.id, -consume, 'Concurrent 1'),
        adjustStock(branchHQ.id, productA.id, -consume, 'Concurrent 2'),
        adjustStock(branchHQ.id, productA.id, -consume, 'Concurrent 3'),
      ];

      const results = await Promise.allSettled(promises);

      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(
        successes.length,
        1,
        'Only one concurrent transaction should succeed'
      );
      assert.strictEqual(
        failures.length,
        2,
        'The others should fail due to insufficient stock or transaction conflict'
      );

      const final = await prisma.branchStock.findUnique({
        where: {
          branchId_productId: { branchId: branchHQ.id, productId: productA.id },
        },
      });
      assert.ok(final!.onHand >= 0, 'Stock must not be negative');

      // Restore stock for subsequent tests
      await adjustStock(
        branchHQ.id,
        productA.id,
        consume,
        'Restore after concurrency test'
      );
    });
  });

  describe('Transfers', () => {
    let transferId: string;

    it('creates a transfer request', async () => {
      currentMockCookie.value = 'active_hq_user';
      const transfer = await createTransfer(
        branchHQ.id,
        branchOther.id,
        productA.id,
        10
      );
      assert.strictEqual(transfer.status, 'PENDING');
      transferId = transfer.id;
    });

    it('dispatches a transfer (decrements origin)', async () => {
      currentMockCookie.value = 'active_hq_user';
      const transfer = await dispatchTransfer(transferId);
      assert.strictEqual(transfer.status, 'IN_TRANSIT');

      const stock = await prisma.branchStock.findUnique({
        where: {
          branchId_productId: { branchId: branchHQ.id, productId: productA.id },
        },
      });
      assert.ok(stock);
      assert.strictEqual(stock.onHand, 30); // 40 - 10
    });

    it('receives a transfer (increments destination)', async () => {
      currentMockCookie.value = 'active_other_user';
      const transfer = await receiveTransfer(transferId);
      assert.strictEqual(transfer.status, 'COMPLETED');

      const stock = await prisma.branchStock.findUnique({
        where: {
          branchId_productId: {
            branchId: branchOther.id,
            productId: productA.id,
          },
        },
      });
      assert.ok(stock);
      assert.strictEqual(stock.onHand, 10);
    });

    it('cancels a transfer safely', async () => {
      currentMockCookie.value = 'active_hq_user';
      const t = await createTransfer(
        branchHQ.id,
        branchOther.id,
        productA.id,
        5
      );
      const cancelled = await cancelTransfer(t.id);
      assert.strictEqual(cancelled.status, 'CANCELLED');
    });
  });
});
