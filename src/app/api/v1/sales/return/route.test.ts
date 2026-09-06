import { describe, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as assert from 'node:assert';
import { POST } from './route';
import { NextRequest } from 'next/server';
import {
  SaleStatus,
  PaymentMethod,
  MovementType,
  Prisma,
} from '@/generated/prisma/client';

const { currentMockCookie, testFirebaseUid, testEmail } = vi.hoisted(() => {
  const ts = Date.now();
  return {
    currentMockCookie: { value: undefined as string | undefined },
    testFirebaseUid: `cashier_uid_${ts}`,
    testEmail: `cashier_api_${ts}@test.com`,
  };
});

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

vi.mock('@/lib/firebase/admin', () => ({
  isFirebaseAdminConfigured: () => true,
  getFirebaseAdminAuth: () => ({
    verifySessionCookie: async () => {
      if (currentMockCookie.value === 'active_cashier') {
        return {
          uid: testFirebaseUid,
          email: testEmail,
          email_verified: true,
        };
      }
      throw new Error('auth/invalid-session-cookie');
    },
  }),
}));

describe('Mobile API - Sales Returns', async () => {
  const { prisma } = await import('@/lib/prisma');

  let mainBranchId: string;
  let cashierUserId: string;
  let customerId: string;
  let product1Id: string;

  beforeAll(async () => {
    const branch1 = await prisma.branch.upsert({
      where: { code: 'TB1_API' },
      update: {},
      create: { name: 'Test Branch 1 API', code: 'TB1_API', isActive: true },
    });
    mainBranchId = branch1.id;

    const role = await prisma.role.upsert({
      where: { name: 'Test Cashier API' },
      update: {},
      create: { name: 'Test Cashier API' },
    });

    const perms = ['sales:create', 'sales:update'];
    for (const p of perms) {
      const perm = await prisma.permission.upsert({
        where: { name: p },
        update: {},
        create: { name: p, description: p },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }

    const cashierUser = await prisma.user.upsert({
      where: { email: testEmail },
      update: {
        firebaseUid: testFirebaseUid,
        branchId: mainBranchId,
        roleId: role.id,
      },
      create: {
        email: testEmail,
        firstName: 'Cash',
        lastName: 'Ier API',
        branchId: mainBranchId,
        roleId: role.id,
        firebaseUid: testFirebaseUid,
        emailVerified: true,
        isActive: true,
      },
    });
    cashierUserId = cashierUser.id;

    const customer = await prisma.customer.create({
      data: {
        firstName: 'Test',
        lastName: 'Customer API',
        createdById: cashierUserId,
      },
    });
    customerId = customer.id;

    const product1 = await prisma.product.upsert({
      where: { sku: 'TEST-PROD-1-API' },
      update: {},
      create: {
        name: 'Product 1 API',
        sku: 'TEST-PROD-1-API',
        sellingPrice: 100.0,
      },
    });
    product1Id = product1.id;

    await prisma.branchStock.create({
      data: {
        branchId: mainBranchId,
        productId: product1Id,
        onHand: 10,
      },
    });
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany({
      where: { branchId: mainBranchId },
    });
    await prisma.branchStock.deleteMany({
      where: { branchId: mainBranchId },
    });
    await prisma.payment.deleteMany({
      where: { sale: { branchId: mainBranchId } },
    });
    await prisma.saleItem.deleteMany({
      where: { sale: { branchId: mainBranchId } },
    });
    await prisma.sale.deleteMany({
      where: { branchId: mainBranchId },
    });
    try {
      await prisma.customer.deleteMany({ where: { id: customerId } });
    } catch (e) {
      // Ignore restrict failure
    }
    await prisma.user.deleteMany({
      where: { id: cashierUserId },
    });
    await prisma.role.deleteMany({ where: { name: 'Test Cashier API' } });
    await prisma.product.deleteMany({
      where: { id: product1Id },
    });
    await prisma.branch.deleteMany({
      where: { id: mainBranchId },
    });
  });

  beforeEach(() => {
    currentMockCookie.value = 'active_cashier';
  });

  it('POST /api/v1/sales/return succeeds', async () => {
    const sale = await prisma.sale.create({
      data: {
        customerId,
        branchId: mainBranchId,
        createdById: cashierUserId,
        status: SaleStatus.COMPLETED,
        total: new Prisma.Decimal(100.0),
      },
    });

    const item = await prisma.saleItem.create({
      data: {
        saleId: sale.id,
        productId: product1Id,
        sku: 'TEST-PROD-1-API',
        productName: 'Product 1',
        quantity: 1,
        unitPrice: 100.0,
        subtotal: 100.0,
        total: 100.0,
      },
    });

    await prisma.payment.create({
      data: {
        saleId: sale.id,
        amount: 100.0,
        method: PaymentMethod.CASH,
        createdById: cashierUserId,
      },
    });

    const req = new NextRequest('http://localhost/api/v1/sales/return', {
      method: 'POST',
      body: JSON.stringify({
        saleId: sale.id,
        saleItemId: item.id,
        quantity: 1,
        refundAmount: 100,
        refundMethod: 'CASH',
      }),
    });

    const res = await POST(req, {});
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
  });
});
