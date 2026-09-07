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
      if (currentMockCookie.value === 'active_hq_audit_user') {
        return {
          uid: 'hq_audit_uid',
          email: 'hq_audit@test.local',
          email_verified: true,
        };
      }
      if (currentMockCookie.value === 'active_other_user') {
        return {
          uid: 'other_inv_uid',
          email: 'other@test.local',
          email_verified: true,
        };
      }
      throw new Error('auth/invalid-session-cookie');
    },
  }),
}));

describe('Inventory Audit Actions & Concurrency', async () => {
  const prisma = (await import('../prisma')).default;
  const { createAudit, upsertAuditItem, updateAuditStatus, completeAudit } =
    await import('./audit-actions');
  const { receiveStock, adjustStock } = await import('./actions');

  let branchHQ: { id: string };
  let productA: { id: string };
  let productB: { id: string };

  beforeAll(async () => {
    // 1. Setup branches
    branchHQ = await prisma.branch.upsert({
      where: { code: 'AUDIT_HQ' },
      update: {},
      create: { name: 'Audit Head Office', code: 'AUDIT_HQ' },
    });

    const roleManager = await prisma.role.upsert({
      where: { name: 'Branch Manager' },
      update: {},
      create: { name: 'Branch Manager' },
    });

    const requiredPermissions = ['inventory:write', 'inventory:read'];
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

    // Clean users and their dependencies
    await prisma.stockMovement.deleteMany({
      where: { branchId: branchHQ.id },
    });
    await prisma.branchStock.deleteMany({
      where: { branchId: branchHQ.id },
    });
    await prisma.stockAudit.deleteMany({
      where: { branchId: branchHQ.id },
    });

    try {
      await prisma.user.deleteMany({
        where: { email: { in: ['hq_audit@test.local'] } },
      });
    } catch {}

    await prisma.product.deleteMany({
      where: {
        sku: {
          in: ['AUDIT-SKU-1', 'AUDIT-SKU-2'],
        },
      },
    });

    await prisma.user.upsert({
      where: { email: 'hq_audit@test.local' },
      update: {
        firebaseUid: 'hq_audit_uid',
        branchId: branchHQ.id,
        roleId: roleManager.id,
      },
      create: {
        firstName: 'HQ',
        lastName: 'User',
        email: 'hq_audit@test.local',
        firebaseUid: 'hq_audit_uid',
        isActive: true,
        emailVerified: true,
        branchId: branchHQ.id,
        roleId: roleManager.id,
      },
    });

    productA = await prisma.product.create({
      data: { sku: 'AUDIT-SKU-1', name: 'Audit Product 1' },
    });
    productB = await prisma.product.create({
      data: { sku: 'AUDIT-SKU-2', name: 'Audit Product 2' },
    });
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany({ where: { branchId: branchHQ.id } });
    await prisma.branchStock.deleteMany({ where: { branchId: branchHQ.id } });
    await prisma.stockAudit.deleteMany({ where: { branchId: branchHQ.id } });
    await prisma.product.deleteMany({
      where: { sku: { in: ['AUDIT-SKU-1', 'AUDIT-SKU-2'] } },
    });
    try {
      await prisma.user.deleteMany({
        where: { email: { in: ['hq_audit@test.local'] } },
      });
    } catch {}
    await prisma.$disconnect();
  });

  describe('Audit Lifecycle', () => {
    let auditId: string;

    it('creates an audit', async () => {
      currentMockCookie.value = 'active_hq_audit_user';
      // Setup initial stock
      await receiveStock(branchHQ.id, productA.id, 50, 'Initial setup');
      await receiveStock(branchHQ.id, productB.id, 20, 'Initial setup');

      const audit = await createAudit(branchHQ.id, 'Monthly Cycle Count');
      assert.strictEqual(audit.status, 'IN_PROGRESS');
      auditId = audit.id;
    });

    it('upserts counted items', async () => {
      currentMockCookie.value = 'active_hq_audit_user';

      // Count 45 of Product A (Shrinkage of 5)
      await upsertAuditItem(auditId, productA.id, 45, 'set');

      // Count 25 of Product B (Gain of 5)
      await upsertAuditItem(auditId, productB.id, 25, 'set');

      const items = await prisma.stockAuditItem.findMany({
        where: { stockAuditId: auditId },
      });
      assert.strictEqual(items.length, 2);

      const itemA = items.find((i) => i.productId === productA.id);
      assert.ok(itemA);
      assert.strictEqual(itemA.countedQuantity, 45);
      assert.strictEqual(itemA.systemQuantity, 50); // Snapshot
    });

    it('increments counted items', async () => {
      currentMockCookie.value = 'active_hq_audit_user';
      // Add 2 more to Product A using increment mode
      await upsertAuditItem(auditId, productA.id, 2, 'increment');

      const itemA = await prisma.stockAuditItem.findUnique({
        where: {
          stockAuditId_productId: {
            stockAuditId: auditId,
            productId: productA.id,
          },
        },
      });
      assert.ok(itemA);
      assert.strictEqual(itemA.countedQuantity, 47); // 45 + 2
    });

    it('transitions to REVIEW', async () => {
      currentMockCookie.value = 'active_hq_audit_user';
      const audit = await updateAuditStatus(auditId, 'REVIEW');
      assert.strictEqual(audit.status, 'REVIEW');
    });

    it('computes point-in-time variance correctly during completion despite concurrent sales', async () => {
      currentMockCookie.value = 'active_hq_audit_user';

      // The current system stock is A: 50, B: 20
      // The counted stock is A: 47, B: 25

      // But wait! Right before completion, a cashier rings up a sale for 2 units of Product A
      await adjustStock(branchHQ.id, productA.id, -2, 'Sale during audit');

      // The new absolute system stock is A: 48, B: 20
      // So the true variance for A should be 47 (counted) - 48 (system) = -1
      // The variance for B should be 25 (counted) - 20 (system) = +5

      // Fire completion
      const completedAudit = await completeAudit(auditId);
      assert.strictEqual(completedAudit.status, 'COMPLETED');

      const items = await prisma.stockAuditItem.findMany({
        where: { stockAuditId: auditId },
      });
      const itemA = items.find((i) => i.productId === productA.id);
      const itemB = items.find((i) => i.productId === productB.id);

      // Verify Variance
      assert.strictEqual(itemA?.variance, -1);
      assert.strictEqual(itemB?.variance, 5);

      // Verify Final Stock Ledger
      const stockA = await prisma.branchStock.findUnique({
        where: {
          branchId_productId: { branchId: branchHQ.id, productId: productA.id },
        },
      });
      const stockB = await prisma.branchStock.findUnique({
        where: {
          branchId_productId: { branchId: branchHQ.id, productId: productB.id },
        },
      });

      assert.strictEqual(
        stockA?.onHand,
        47,
        'Stock A should exactly match the physical count of 47'
      );
      assert.strictEqual(
        stockB?.onHand,
        25,
        'Stock B should exactly match the physical count of 25'
      );

      // Verify Movements generated
      const movementsA = await prisma.stockMovement.findMany({
        where: {
          branchId: branchHQ.id,
          productId: productA.id,
          type: 'ADJUSTMENT',
          referenceId: auditId,
        },
      });
      assert.strictEqual(movementsA.length, 1);
      assert.strictEqual(movementsA[0].quantity, -1);
    });

    it('rejects changes to COMPLETED audits', async () => {
      currentMockCookie.value = 'active_hq_audit_user';
      await assert.rejects(
        updateAuditStatus(auditId, 'IN_PROGRESS'),
        (err: Error) =>
          err.message.includes('Cannot change status of a terminal audit') ||
          err.message.includes('Can only transition')
      );
      await assert.rejects(completeAudit(auditId), (err: Error) =>
        err.message.includes('Audit must be in REVIEW status')
      );
      await assert.rejects(
        upsertAuditItem(auditId, productA.id, 1, 'set'),
        (err: Error) => err.message.includes('Audit is not in progress')
      );
    });
  });

  describe('Concurrency & Security Hardening', () => {
    it('prevents lost updates during concurrent increments (read-modify-write race condition)', async () => {
      currentMockCookie.value = 'active_hq_audit_user';
      const audit = await createAudit(branchHQ.id, 'Concurrency Test Audit');

      // Simulate 5 concurrent increments of 1 unit
      await Promise.all([
        upsertAuditItem(audit.id, productA.id, 1, 'increment'),
        upsertAuditItem(audit.id, productA.id, 1, 'increment'),
        upsertAuditItem(audit.id, productA.id, 1, 'increment'),
        upsertAuditItem(audit.id, productA.id, 1, 'increment'),
        upsertAuditItem(audit.id, productA.id, 1, 'increment'),
      ]);

      const itemA = await prisma.stockAuditItem.findUnique({
        where: {
          stockAuditId_productId: {
            stockAuditId: audit.id,
            productId: productA.id,
          },
        },
      });
      assert.strictEqual(
        itemA?.countedQuantity,
        5,
        'Should not lose any concurrent increments'
      );

      // Cleanup for next test
      await prisma.stockAuditItem.deleteMany({
        where: { stockAuditId: audit.id },
      });
      await prisma.stockAudit.delete({ where: { id: audit.id } });
    });

    it('prevents double completion due to missing explicit row lock', async () => {
      currentMockCookie.value = 'active_hq_audit_user';
      const audit = await createAudit(branchHQ.id, 'Double Complete Audit');

      await upsertAuditItem(audit.id, productA.id, 5, 'set');
      await updateAuditStatus(audit.id, 'REVIEW');

      // Attempt concurrent completions
      const results = await Promise.allSettled([
        completeAudit(audit.id),
        completeAudit(audit.id),
      ]);

      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(
        successes.length,
        1,
        'Exactly one completion should succeed'
      );
      assert.strictEqual(
        failures.length,
        1,
        'Exactly one completion should be rejected due to lock/status check'
      );

      // Cleanup
      await prisma.stockAuditItem.deleteMany({
        where: { stockAuditId: audit.id },
      });
      await prisma.stockAudit.delete({ where: { id: audit.id } });
    });
  });
});
