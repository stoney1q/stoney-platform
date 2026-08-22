import { describe, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as assert from 'node:assert';
// Prisma types can be imported statically
import {
  SaleStatus,
  PaymentMethod,
  MovementType,
  Prisma,
} from '@/generated/prisma/client';

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
      if (currentMockCookie.value === 'active_cashier') {
        return { uid: 'cashier_uid', email: 'cashier@test.com' };
      }
      if (currentMockCookie.value === 'active_other') {
        return { uid: 'other_uid', email: 'other@test.com' };
      }
      throw new Error('auth/invalid-session-cookie');
    },
  }),
}));

describe('Sales Foundation Actions', async () => {
  const { prisma } = await import('../prisma');
  const { createSale, addSaleItem, applyPayment, cancelSale } =
    await import('./actions');

  let mainBranchId: string;
  let otherBranchId: string;
  let cashierUserId: string;
  let otherUserId: string;
  let customerId: string;
  let product1Id: string;
  let product2Id: string;

  beforeAll(async () => {
    // Setup test data
    const branch1 = await prisma.branch.upsert({
      where: { code: 'TB1' },
      update: {},
      create: { name: 'Test Branch 1', code: 'TB1', isActive: true },
    });
    mainBranchId = branch1.id;

    const branch2 = await prisma.branch.upsert({
      where: { code: 'TB2' },
      update: {},
      create: { name: 'Test Branch 2', code: 'TB2', isActive: true },
    });
    otherBranchId = branch2.id;

    const role = await prisma.role.upsert({
      where: { name: 'Test Cashier' },
      update: {},
      create: { name: 'Test Cashier' },
    });

    const cashierUser = await prisma.user.upsert({
      where: { email: 'cashier@test.com' },
      update: {
        firebaseUid: 'cashier_uid',
        branchId: mainBranchId,
        roleId: role.id,
      },
      create: {
        email: 'cashier@test.com',
        firstName: 'Cash',
        lastName: 'Ier',
        branchId: mainBranchId,
        roleId: role.id,
        firebaseUid: 'cashier_uid',
        emailVerified: true,
        isActive: true,
      },
    });
    cashierUserId = cashierUser.id;

    const otherUser = await prisma.user.upsert({
      where: { email: 'other@test.com' },
      update: {
        firebaseUid: 'other_uid',
        branchId: otherBranchId,
        roleId: role.id,
      },
      create: {
        email: 'other@test.com',
        firstName: 'Other',
        lastName: 'User',
        branchId: otherBranchId,
        roleId: role.id,
        firebaseUid: 'other_uid',
        emailVerified: true,
        isActive: true,
      },
    });
    otherUserId = otherUser.id;

    const perms = ['sales:create', 'payments:create', 'sales:delete'];
    for (const p of perms) {
      const perm = await prisma.permission.upsert({
        where: { name: p },
        update: {},
        create: { name: p, description: p },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }

    const customer = await prisma.customer.create({
      data: {
        firstName: 'Test',
        lastName: 'Customer',
        createdById: cashierUserId,
      },
    });
    customerId = customer.id;

    const product1 = await prisma.product.upsert({
      where: { sku: 'TEST-PROD-1' },
      update: {},
      create: {
        name: 'Product 1',
        sku: 'TEST-PROD-1',
        sellingPrice: 100.0,
      },
    });
    product1Id = product1.id;

    const product2 = await prisma.product.upsert({
      where: { sku: 'TEST-PROD-2' },
      update: {},
      create: {
        name: 'Product 2',
        sku: 'TEST-PROD-2',
        sellingPrice: 50.0,
      },
    });
    product2Id = product2.id;

    // Clean up stock first
    await prisma.branchStock.deleteMany({ where: { branchId: mainBranchId } });

    // Stock for branch 1
    await prisma.branchStock.create({
      data: {
        branchId: mainBranchId,
        productId: product1Id,
        onHand: 10,
      },
    });

    await prisma.branchStock.create({
      data: {
        branchId: mainBranchId,
        productId: product2Id,
        onHand: 2, // Low stock for concurrency testing
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.stockMovement.deleteMany({
      where: { branchId: { in: [mainBranchId, otherBranchId] } },
    });
    await prisma.branchStock.deleteMany({
      where: { branchId: { in: [mainBranchId, otherBranchId] } },
    });
    await prisma.payment.deleteMany({
      where: { sale: { branchId: { in: [mainBranchId, otherBranchId] } } },
    });
    await prisma.saleItem.deleteMany({
      where: { sale: { branchId: { in: [mainBranchId, otherBranchId] } } },
    });
    await prisma.sale.deleteMany({
      where: { branchId: { in: [mainBranchId, otherBranchId] } },
    });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.user.deleteMany({
      where: { id: { in: [cashierUserId, otherUserId] } },
    });
    await prisma.role.deleteMany({ where: { name: 'Test Cashier' } });
    await prisma.product.deleteMany({
      where: { id: { in: [product1Id, product2Id] } },
    });
    await prisma.branch.deleteMany({
      where: { id: { in: [mainBranchId, otherBranchId] } },
    });
  });

  beforeEach(() => {
    currentMockCookie.value = 'active_cashier';
  });

  it('creates a sale securely', async () => {
    const formData = new FormData();
    formData.append('customerId', customerId);

    const sale = await createSale(formData);

    assert.strictEqual(sale.status, SaleStatus.PENDING);
    assert.strictEqual(sale.branchId, mainBranchId);
    assert.strictEqual(sale.createdById, cashierUserId);
    assert.strictEqual(sale.customerId, customerId);
  });

  it('adds an item and automatically calculates totals', async () => {
    const sale = await prisma.sale.create({
      data: {
        customerId,
        branchId: mainBranchId,
        createdById: cashierUserId,
        status: SaleStatus.PENDING,
      },
    });

    const formData = new FormData();
    formData.append('saleId', sale.id);
    formData.append('productId', product1Id);
    formData.append('quantity', '2');
    formData.append('discount', '10.00'); // $10 off the line

    await addSaleItem(formData);

    const updatedSale = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: { items: true },
    });

    assert.strictEqual(updatedSale!.items.length, 1);
    assert.strictEqual(updatedSale!.items[0].quantity, 2);
    // 100 * 2 = 200 - 10 = 190
    assert.strictEqual(updatedSale!.items[0].subtotal.toString(), '200');
    assert.strictEqual(updatedSale!.items[0].total.toString(), '190');
    assert.strictEqual(updatedSale!.items[0].unitPrice.toString(), '100');

    assert.strictEqual(updatedSale!.subtotal.toString(), '190');
    assert.strictEqual(updatedSale!.total.toString(), '190');
  });

  it('rejects negative quantity', async () => {
    const sale = await prisma.sale.create({
      data: {
        customerId,
        branchId: mainBranchId,
        createdById: cashierUserId,
        status: SaleStatus.PENDING,
      },
    });

    const formData = new FormData();
    formData.append('saleId', sale.id);
    formData.append('productId', product1Id);
    formData.append('quantity', '-1');

    await assert.rejects(
      addSaleItem(formData),
      /Quantity must be greater than zero/
    );
  });

  it('rejects overpayment', async () => {
    const sale = await prisma.sale.create({
      data: {
        customerId,
        branchId: mainBranchId,
        createdById: cashierUserId,
        status: SaleStatus.PENDING,
        total: new Prisma.Decimal(100.0),
      },
    });

    const formData = new FormData();
    formData.append('saleId', sale.id);
    formData.append('amount', '101.00');
    formData.append('method', PaymentMethod.CASH);
    formData.append('reference', 'TEST-REF');

    await assert.rejects(applyPayment(formData), /Overpayment is not allowed/);
  });

  it('partial payment leaves sale pending and does not deduct inventory', async () => {
    const sale = await prisma.sale.create({
      data: {
        customerId,
        branchId: mainBranchId,
        createdById: cashierUserId,
        status: SaleStatus.PENDING,
        total: new Prisma.Decimal(100.0),
      },
    });

    await prisma.saleItem.create({
      data: {
        saleId: sale.id,
        productId: product1Id,
        sku: 'TEST-PROD-1',
        productName: 'Product 1',
        quantity: 1,
        unitPrice: 100.0,
        subtotal: 100.0,
        total: 100.0,
      },
    });

    const initialStock = await prisma.branchStock.findUnique({
      where: {
        branchId_productId: { branchId: mainBranchId, productId: product1Id },
      },
    });

    const formData = new FormData();
    formData.append('saleId', sale.id);
    formData.append('amount', '50.00');
    formData.append('method', PaymentMethod.CASH);
    formData.append('reference', 'TEST-REF');

    await applyPayment(formData);

    const updatedSale = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: { payments: true },
    });
    assert.strictEqual(updatedSale!.status, SaleStatus.PENDING);
    assert.strictEqual(updatedSale!.payments.length, 1);

    const currentStock = await prisma.branchStock.findUnique({
      where: {
        branchId_productId: { branchId: mainBranchId, productId: product1Id },
      },
    });
    assert.strictEqual(currentStock!.onHand, initialStock!.onHand); // Not deducted yet
  });

  it('final payment completes sale and atomically deducts inventory', async () => {
    const sale = await prisma.sale.create({
      data: {
        customerId,
        branchId: mainBranchId,
        createdById: cashierUserId,
        status: SaleStatus.PENDING,
        total: new Prisma.Decimal(100.0),
      },
    });

    await prisma.saleItem.create({
      data: {
        saleId: sale.id,
        productId: product1Id,
        sku: 'TEST-PROD-1',
        productName: 'Product 1',
        quantity: 1,
        unitPrice: 100.0,
        subtotal: 100.0,
        total: 100.0,
      },
    });

    const initialStock = await prisma.branchStock.findUnique({
      where: {
        branchId_productId: { branchId: mainBranchId, productId: product1Id },
      },
    });

    const formData = new FormData();
    formData.append('saleId', sale.id);
    formData.append('amount', '100.00');
    formData.append('method', PaymentMethod.CASH);
    formData.append('reference', 'TEST-REF');

    await applyPayment(formData);

    const updatedSale = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: { payments: true },
    });
    assert.strictEqual(updatedSale!.status, SaleStatus.COMPLETED);
    assert.ok(updatedSale!.completedAt !== null);

    const currentStock = await prisma.branchStock.findUnique({
      where: {
        branchId_productId: { branchId: mainBranchId, productId: product1Id },
      },
    });
    assert.strictEqual(currentStock!.onHand, initialStock!.onHand - 1);

    const stockMovement = await prisma.stockMovement.findFirst({
      where: { referenceId: sale.id, type: MovementType.SALE },
    });
    assert.ok(stockMovement);
    assert.strictEqual(stockMovement.quantity, -1);
  });

  it('rolls back payment if inventory is insufficient', async () => {
    const sale = await prisma.sale.create({
      data: {
        customerId,
        branchId: mainBranchId,
        createdById: cashierUserId,
        status: SaleStatus.PENDING,
        total: new Prisma.Decimal(100.0),
      },
    });

    await prisma.saleItem.create({
      data: {
        saleId: sale.id,
        productId: product2Id,
        sku: 'TEST-PROD-2',
        productName: 'Product 2',
        quantity: 5, // We only have 2 in stock
        unitPrice: 100.0,
        subtotal: 100.0,
        total: 100.0,
      },
    });

    const formData = new FormData();
    formData.append('saleId', sale.id);
    formData.append('amount', '100.00');
    formData.append('method', PaymentMethod.CASH);
    formData.append('reference', 'TEST-REF');

    await assert.rejects(applyPayment(formData), /Insufficient stock/);

    const payments = await prisma.payment.findMany({
      where: { saleId: sale.id },
    });
    assert.strictEqual(payments.length, 0); // Payment rolled back

    const updatedSale = await prisma.sale.findUnique({
      where: { id: sale.id },
    });
    assert.strictEqual(updatedSale!.status, SaleStatus.PENDING);
  });

  it('can be cancelled if zero payments exist', async () => {
    const sale = await prisma.sale.create({
      data: {
        customerId,
        branchId: mainBranchId,
        createdById: cashierUserId,
        status: SaleStatus.PENDING,
      },
    });

    const formData = new FormData();
    formData.append('saleId', sale.id);

    await cancelSale(formData);

    const updatedSale = await prisma.sale.findUnique({
      where: { id: sale.id },
    });
    assert.strictEqual(updatedSale!.status, SaleStatus.CANCELLED);
    assert.ok(updatedSale!.cancelledAt !== null);
  });

  it('rejects cancellation if payments exist', async () => {
    const sale = await prisma.sale.create({
      data: {
        customerId,
        branchId: mainBranchId,
        createdById: cashierUserId,
        status: SaleStatus.PENDING,
        total: new Prisma.Decimal(100.0),
      },
    });

    await prisma.payment.create({
      data: {
        saleId: sale.id,
        amount: 50.0,
        method: PaymentMethod.CASH,
        createdById: cashierUserId,
      },
    });

    const formData = new FormData();
    formData.append('saleId', sale.id);

    await assert.rejects(
      cancelSale(formData),
      /Cannot cancel a sale with existing payments/
    );
  });

  it('completed sale cannot be modified', async () => {
    const sale = await prisma.sale.create({
      data: {
        customerId,
        branchId: mainBranchId,
        createdById: cashierUserId,
        status: SaleStatus.COMPLETED, // Already completed
      },
    });

    const formData = new FormData();
    formData.append('saleId', sale.id);
    formData.append('productId', product1Id);
    formData.append('quantity', '1');

    await assert.rejects(
      addSaleItem(formData),
      /Can only add items to a pending sale/
    );
  });

  it('enforces branch isolation', async () => {
    currentMockCookie.value = 'active_other';

    const sale = await prisma.sale.create({
      data: {
        customerId,
        branchId: mainBranchId,
        createdById: cashierUserId,
        status: SaleStatus.PENDING,
      },
    });

    const formData = new FormData();
    formData.append('saleId', sale.id);
    formData.append('productId', product1Id);
    formData.append('quantity', '1');

    await assert.rejects(addSaleItem(formData), /Access denied/);
  });
});
