import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  ProductType,
  RepairStatus,
  MovementType,
  FulfillmentStatus,
  QuotationStatus,
} from '@/generated/prisma/client';
import {
  createRepair,
  updateRepairStatus,
  consumeRepairPart,
  returnRepairPart,
  cancelRepair,
  createDevice,
  updateDevice,
  deleteDevice,
  searchRepairs,
  assignTechnician,
  planRepairPart,
} from './actions';
import { convertQuotationToSale } from '@/lib/quotations/actions';
import { applyPayment } from '@/lib/sales/actions';
import { PaymentMethod } from '@/generated/prisma/client';
import { vi } from 'vitest';
interface MockSession {
  id: string;
  email: string;
  branchId: string;
  roleId: string;
  permissions: string[];
}

let currentMockSession: MockSession | null = null;

vi.mock('@/lib/auth/guard', () => ({
  requireAuth: vi
    .fn()
    .mockImplementation(() => Promise.resolve(currentMockSession)),
  requirePermission: vi
    .fn()
    .mockImplementation(() => Promise.resolve(currentMockSession)),
  requireBranchAccess: vi.fn().mockResolvedValue(true),
}));

describe('Repairs Actions', () => {
  let branchId: string;
  let customerId: string;
  let deviceId: string;
  let productId: string;
  let technicianId: string;

  let roleId: string;
  let userId: string;

  afterEach(async () => {
    // Scoped cleanup
    await prisma.stockMovement.deleteMany({ where: { branchId } });
    await prisma.repairLog.deleteMany({ where: { repair: { branchId } } });
    await prisma.repairPart.deleteMany({ where: { repair: { branchId } } });
    await prisma.repair.updateMany({
      where: { branchId },
      data: { activeQuotationId: null },
    });

    await prisma.quotationItem.deleteMany({
      where: { quotation: { branchId } },
    });
    await prisma.quotation.updateMany({
      where: { branchId },
      data: { repairId: null },
    });
    await prisma.quotation.deleteMany({ where: { branchId } });

    await prisma.saleItem.deleteMany({ where: { sale: { branchId } } });
    await prisma.payment.deleteMany({ where: { sale: { branchId } } });
    await prisma.sale.deleteMany({ where: { branchId } });

    await prisma.repair.deleteMany({ where: { branchId } });

    await prisma.device.deleteMany({ where: { customerId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.branchStock.deleteMany({ where: { branchId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.user.deleteMany({ where: { branchId } });
    if (roleId) await prisma.role.deleteMany({ where: { id: roleId } });
    if (branchId) await prisma.branch.deleteMany({ where: { id: branchId } });
  });

  beforeEach(async () => {
    // Basic seed for tests
    const branch = await prisma.branch.create({
      data: {
        name: 'Test Branch',
        code: `TEST_BR_${Date.now()}_${Math.random()}`,
      },
    });
    branchId = branch.id;

    const role = await prisma.role.create({
      data: { name: `Test Role ${Date.now()}_${Math.random()}` },
    });
    roleId = role.id;

    const user = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: `test-${Date.now()}@repair.com`,
        branchId,
        roleId: role.id,
      },
    });
    userId = user.id;

    const tech = await prisma.user.create({
      data: {
        firstName: 'Tech',
        lastName: 'User',
        email: `tech-${Date.now()}@repair.com`,
        branchId,
        roleId: role.id,
      },
    });
    technicianId = tech.id;

    currentMockSession = {
      id: user.id,
      email: user.email,
      branchId: user.branchId,
      roleId: user.roleId,
      permissions: [], // Permissions are mocked via requirePermission
    };

    const customer = await prisma.customer.create({
      data: {
        firstName: 'Customer',
        lastName: 'Repair',
        createdById: user.id,
      },
    });
    customerId = customer.id;

    const device = await prisma.device.create({
      data: {
        customerId,
        make: 'Apple',
        model: 'iPhone 13',
      },
    });
    deviceId = device.id;

    const product = await prisma.product.create({
      data: {
        name: 'Screen',
        sku: 'SCR-1',
        type: ProductType.GOODS,
        sellingPrice: 100,
      },
    });
    productId = product.id;

    await prisma.branchStock.create({
      data: {
        branchId,
        productId,
        onHand: 10,
      },
    });
  });

  it('creates a repair', async () => {
    const formData = new FormData();
    formData.set('customerId', customerId);
    formData.set('deviceId', deviceId);
    formData.set('issue', 'Broken screen');
    formData.set('notes', 'Customer dropped it');

    const repair = await createRepair(formData);
    expect(repair.status).toBe(RepairStatus.RECEIVED);
    expect(repair.issue).toBe('Broken screen');

    const logs = await prisma.repairLog.findMany({
      where: { repairId: repair.id },
    });
    expect(logs.length).toBe(1);
  });

  it('consumes and returns repair parts correctly (atomic stock update)', async () => {
    const formData = new FormData();
    formData.set('customerId', customerId);
    formData.set('deviceId', deviceId);
    formData.set('issue', 'Broken screen');
    const repair = await createRepair(formData);

    const consumeData = new FormData();
    consumeData.set('repairId', repair.id);
    consumeData.set('productId', productId);
    consumeData.set('quantity', '2');
    consumeData.set('version', '1');

    await consumeRepairPart(consumeData);

    const part = await prisma.repairPart.findUnique({
      where: { repairId_productId: { repairId: repair.id, productId } },
    });
    expect(part?.consumedQuantity).toBe(2);

    const stock = await prisma.branchStock.findUnique({
      where: { branchId_productId: { branchId, productId } },
    });
    expect(stock?.onHand).toBe(8);

    const movements = await prisma.stockMovement.findMany({
      where: { referenceId: repair.id },
    });
    expect(movements[0].type).toBe(MovementType.REPAIR_CONSUMPTION);
    expect(movements[0].quantity).toBe(-2);

    // Return 1 part
    const returnData = new FormData();
    returnData.set('repairId', repair.id);
    returnData.set('productId', productId);
    returnData.set('quantity', '1');
    returnData.set('version', '2');

    await returnRepairPart(returnData);

    const partAfterReturn = await prisma.repairPart.findUnique({
      where: { repairId_productId: { repairId: repair.id, productId } },
    });
    expect(partAfterReturn?.returnedQuantity).toBe(1);

    const stockAfterReturn = await prisma.branchStock.findUnique({
      where: { branchId_productId: { branchId, productId } },
    });
    expect(stockAfterReturn?.onHand).toBe(9);
  });

  it('prevents cancellation with net consumed parts', async () => {
    const repair = await createRepair(
      (() => {
        const f = new FormData();
        f.set('customerId', customerId);
        f.set('deviceId', deviceId);
        f.set('issue', 'Broken screen');
        return f;
      })()
    );

    await consumeRepairPart(
      (() => {
        const f = new FormData();
        f.set('repairId', repair.id);
        f.set('productId', productId);
        f.set('quantity', '1');
        f.set('version', '1');
        return f;
      })()
    );

    const cancelData = new FormData();
    cancelData.set('repairId', repair.id);
    cancelData.set('version', '2');

    await expect(cancelRepair(cancelData)).rejects.toThrow(
      'Cannot cancel repair with unreturned consumed parts'
    );
  });

  it('optimistic locking prevents concurrent updates', async () => {
    const repair = await createRepair(
      (() => {
        const f = new FormData();
        f.set('customerId', customerId);
        f.set('deviceId', deviceId);
        f.set('issue', 'Test');
        return f;
      })()
    );

    const update1 = new FormData();
    update1.set('repairId', repair.id);
    update1.set('status', RepairStatus.DIAGNOSING);
    update1.set('version', '1');

    const update2 = new FormData();
    update2.set('repairId', repair.id);
    update2.set('status', RepairStatus.QUOTED);
    update2.set('version', '1'); // Stale version

    await updateRepairStatus(update1);
    await expect(updateRepairStatus(update2)).rejects.toThrow();
  });

  it('prevents double inventory deduction during sale fulfillment', async () => {
    const repair = await createRepair(
      (() => {
        const f = new FormData();
        f.set('customerId', customerId);
        f.set('deviceId', deviceId);
        f.set('issue', 'Test');
        return f;
      })()
    );

    // Consume part in repair
    await consumeRepairPart(
      (() => {
        const f = new FormData();
        f.set('repairId', repair.id);
        f.set('productId', productId);
        f.set('quantity', '1');
        f.set('version', '1');
        return f;
      })()
    );

    // Create quotation linked to repair
    const quotation = await prisma.quotation.create({
      data: {
        branchId,
        customerId,
        repairId: repair.id,
        createdById: technicianId, // Using technicianId just as a valid user
        status: QuotationStatus.ACCEPTED, // Auto-accepted for test
        subtotal: 100,
        total: 100,
      },
    });
    await prisma.quotationItem.create({
      data: {
        quotationId: quotation.id,
        productId,
        sku: 'SCR-1',
        productName: 'Screen',
        quantity: 1,
        unitPrice: 100,
        subtotal: 100,
        total: 100,
        fulfillmentStatus: FulfillmentStatus.PRE_FULFILLED, // Already consumed in repair
      },
    });

    // Convert quotation to sale
    const sale = await convertQuotationToSale(
      (() => {
        const f = new FormData();
        f.set('quotationId', quotation.id);
        return f;
      })()
    );

    // Apply payment to complete sale
    await applyPayment(
      (() => {
        const f = new FormData();
        f.set('saleId', sale.id);
        f.set('amount', '100');
        f.set('method', PaymentMethod.CASH);
        return f;
      })()
    );

    // Stock was 10, repair consumed 1, so stock should be 9.
    // The Sale should NOT consume another 1 because fulfillmentStatus is PRE_FULFILLED.
    const stock = await prisma.branchStock.findUnique({
      where: { branchId_productId: { branchId, productId } },
    });
    expect(stock?.onHand).toBe(9);
  });

  describe('Device Management', () => {
    it('creates, updates, and deletes a device', async () => {
      // Create
      const createData = new FormData();
      createData.set('customerId', customerId);
      createData.set('make', 'TestMake');
      createData.set('model', 'TestModel');
      createData.set('serialNumber', 'SN-12345');

      const device = await createDevice(createData);
      expect(device.make).toBe('TestMake');
      expect(device.model).toBe('TestModel');
      expect(device.serialNumber).toBe('SN-12345');

      // Update
      const updateData = new FormData();
      updateData.set('deviceId', device.id);
      updateData.set('make', 'TestMake2');
      updateData.set('model', 'TestModel2');
      updateData.set('serialNumber', 'SN-NEW'); // explicitly set it to avoid undefined behavior in tests

      const updated = await updateDevice(updateData);
      expect(updated.make).toBe('TestMake2');
      expect(updated.serialNumber).toBe('SN-NEW');

      // Delete
      await deleteDevice(device.id);
      const deleted = await prisma.device.findUnique({
        where: { id: device.id },
      });
      expect(deleted).toBeNull();
    });

    it('prevents deleting a device with associated repairs', async () => {
      const createData = new FormData();
      createData.set('customerId', customerId);
      createData.set('make', 'NoDelete');
      createData.set('model', 'Model');
      const device = await createDevice(createData);

      const repairData = new FormData();
      repairData.set('customerId', customerId);
      repairData.set('deviceId', device.id);
      repairData.set('issue', 'Broken screen');
      await createRepair(repairData);

      await expect(deleteDevice(device.id)).rejects.toThrow(
        'Cannot delete a device that has associated repairs'
      );
    });
  });

  describe('Repair Transitions and Locking', () => {
    it('prevents updates on finalized repairs', async () => {
      const repairData = new FormData();
      repairData.set('customerId', customerId);
      repairData.set('deviceId', deviceId);
      repairData.set('issue', 'Broken screen');
      const repair = await createRepair(repairData);

      // Force it to COMPLETED
      await prisma.repair.update({
        where: { id: repair.id },
        data: { status: RepairStatus.COMPLETED },
      });

      const updateData = new FormData();
      updateData.set('repairId', repair.id);
      updateData.set('status', RepairStatus.DELIVERED);
      updateData.set('version', '1');

      await expect(updateRepairStatus(updateData)).rejects.toThrow(
        'Cannot update status of a finalized repair'
      );
    });

    it('allows assigning a technician', async () => {
      const repairData = new FormData();
      repairData.set('customerId', customerId);
      repairData.set('deviceId', deviceId);
      repairData.set('issue', 'Broken screen');
      const repair = await createRepair(repairData);

      const assignData = new FormData();
      assignData.set('repairId', repair.id);
      assignData.set('technicianId', currentMockSession!.id);
      assignData.set('version', repair.version.toString());

      const assigned = await assignTechnician(assignData);
      expect(assigned.technicianId).toBe(currentMockSession!.id);
      expect(assigned.version).toBe(repair.version + 1);
    });

    it('allows planning a repair part', async () => {
      const repairData = new FormData();
      repairData.set('customerId', customerId);
      repairData.set('deviceId', deviceId);
      repairData.set('issue', 'Broken screen');
      const repair = await createRepair(repairData);

      const planData = new FormData();
      planData.set('repairId', repair.id);
      planData.set('productId', productId);
      planData.set('plannedQuantity', '2');
      planData.set('version', repair.version.toString());

      const part = await planRepairPart(planData);
      expect(part.plannedQuantity).toBe(2);
      expect(part.consumedQuantity).toBe(0);
      expect(part.repairId).toBe(repair.id);
      expect(part.productId).toBe(productId);

      const updatedRepair = await prisma.repair.findUnique({
        where: { id: repair.id },
      });
      expect(updatedRepair?.version).toBe(repair.version + 1);
    });

    it('can search repairs', async () => {
      const result = await searchRepairs({ query: '', page: 1 });
      expect(result.success).toBe(true);
      expect(result.data?.repairs).toBeDefined();
    });
  });
});
