import {
  describe,
  it,
  beforeAll,
  afterAll,
  expect,
  beforeEach,
  vi,
} from 'vitest';
import prisma from '@/lib/prisma';
import { getProductPerformanceReport } from './queries';
import { requirePermission } from '@/lib/auth/guard';
import { SaleStatus, Prisma } from '@/generated/prisma/client';

vi.mock('@/lib/auth/guard', () => ({
  requirePermission: vi.fn(),
}));

describe('Reporting Integration Tests (Product Performance)', () => {
  let branchId: string;
  let cashierId: string;
  let customerId: string;
  let pTaxId: string; // Taxable product
  let pNoTaxId: string; // Non-taxable product
  let pMultiId: string;

  beforeAll(async () => {
    const branch = await prisma.branch.upsert({
      where: { code: 'REP-TEST' },
      update: {},
      create: { name: 'Report Test Branch', code: 'REP-TEST', isActive: true },
    });
    branchId = branch.id;

    const role = await prisma.role.upsert({
      where: { name: 'Test Reporter' },
      update: {},
      create: { name: 'Test Reporter' },
    });

    const cashier = await prisma.user.upsert({
      where: { email: 'reporter@test.com' },
      update: { branchId },
      create: {
        email: 'reporter@test.com',
        firstName: 'Rep',
        lastName: 'Orter',
        branchId,
        roleId: role.id,
        firebaseUid: 'reporter_uid',
        emailVerified: true,
        isActive: true,
      },
    });
    cashierId = cashier.id;

    const customer = await prisma.customer.create({
      data: {
        firstName: 'Report',
        lastName: 'Customer',
        createdById: cashierId,
      },
    });
    customerId = customer.id;

    // Create products
    const pTax = await prisma.product.upsert({
      where: { sku: 'PROD-TAX' },
      update: {},
      create: { name: 'Taxable Product', sku: 'PROD-TAX', sellingPrice: 100 },
    });
    pTaxId = pTax.id;

    const pNoTax = await prisma.product.upsert({
      where: { sku: 'PROD-NOTAX' },
      update: {},
      create: { name: 'No Tax Product', sku: 'PROD-NOTAX', sellingPrice: 100 },
    });
    pNoTaxId = pNoTax.id;

    const pMulti = await prisma.product.upsert({
      where: { sku: 'PROD-MULTI' },
      update: {},
      create: { name: 'Multi Product', sku: 'PROD-MULTI', sellingPrice: 50 },
    });
    pMultiId = pMulti.id;

    // Clean up any old sales
    await prisma.saleItem.deleteMany({
      where: { sale: { branchId } },
    });
    await prisma.sale.deleteMany({
      where: { branchId },
    });
  });

  afterAll(async () => {
    await prisma.saleItem.deleteMany({
      where: { sale: { branchId } },
    });
    await prisma.sale.deleteMany({
      where: { branchId },
    });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.user.deleteMany({ where: { id: cashierId } });
    await prisma.role.deleteMany({ where: { name: 'Test Reporter' } });
    await prisma.product.deleteMany({
      where: { id: { in: [pTaxId, pNoTaxId, pMultiId] } },
    });
    await prisma.branch.deleteMany({ where: { id: branchId } });
  });

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(requirePermission).mockResolvedValue({
      id: cashierId,
      role: { name: 'Admin' },
      permissions: ['reports:read', 'admin:global'],
      branchId: branchId,
    } as any);

    await prisma.saleItem.deleteMany({
      where: { sale: { branchId } },
    });
    await prisma.sale.deleteMany({
      where: { branchId },
    });
  });

  // Test 1: Taxable sales
  it('correctly allocates revenue for fully taxable sales without discounts', async () => {
    // 1 item, $100 subtotal, $10 tax = $110 total
    const sale = await prisma.sale.create({
      data: {
        branchId,
        createdById: cashierId,
        customerId,
        status: SaleStatus.COMPLETED,
        subtotal: new Prisma.Decimal(100),
        discount: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(10),
        total: new Prisma.Decimal(110),
        createdAt: new Date(),
        items: {
          create: {
            productId: pTaxId,
            sku: 'PROD-TAX',
            productName: 'Taxable Product',
            quantity: 1,
            unitPrice: new Prisma.Decimal(100),
            discount: new Prisma.Decimal(0),
            taxAmount: new Prisma.Decimal(10),
            subtotal: new Prisma.Decimal(100),
            total: new Prisma.Decimal(110),
          },
        },
      },
    });

    const report = await getProductPerformanceReport({ branchId });
    expect(report.length).toBe(1);
    expect(report[0].sku).toBe('PROD-TAX');
    // It should report the exact total of the item (110)
    expect(report[0].revenue).toBe('110.00');
  });

  // Test 2: Non-taxable sales
  it('correctly allocates revenue for non-taxable sales without discounts', async () => {
    // 1 item, $100 subtotal, $0 tax = $100 total
    await prisma.sale.create({
      data: {
        branchId,
        createdById: cashierId,
        customerId,
        status: SaleStatus.COMPLETED,
        subtotal: new Prisma.Decimal(100),
        discount: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        total: new Prisma.Decimal(100),
        items: {
          create: {
            productId: pNoTaxId,
            sku: 'PROD-NOTAX',
            productName: 'No Tax Product',
            quantity: 1,
            unitPrice: new Prisma.Decimal(100),
            discount: new Prisma.Decimal(0),
            taxAmount: new Prisma.Decimal(0),
            subtotal: new Prisma.Decimal(100),
            total: new Prisma.Decimal(100),
          },
        },
      },
    });

    const report = await getProductPerformanceReport({ branchId });
    expect(report.length).toBe(1);
    expect(report[0].revenue).toBe('100.00');
  });

  // Test 3: Multiple products on the same sale
  it('correctly allocates revenue for multiple products with mixed tax rates', async () => {
    // Item 1: 100 subtotal, 10 tax = 110 total
    // Item 2: 50 subtotal, 0 tax = 50 total
    // Sale subtotal: 150, tax: 10, discount: 0, total: 160
    await prisma.sale.create({
      data: {
        branchId,
        createdById: cashierId,
        customerId,
        status: SaleStatus.COMPLETED,
        subtotal: new Prisma.Decimal(150),
        discount: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(10),
        total: new Prisma.Decimal(160),
        items: {
          create: [
            {
              productId: pTaxId,
              sku: 'PROD-TAX',
              productName: 'Taxable Product',
              quantity: 1,
              unitPrice: new Prisma.Decimal(100),
              discount: new Prisma.Decimal(0),
              taxAmount: new Prisma.Decimal(10),
              subtotal: new Prisma.Decimal(100),
              total: new Prisma.Decimal(110),
            },
            {
              productId: pMultiId,
              sku: 'PROD-MULTI',
              productName: 'Multi Product',
              quantity: 1,
              unitPrice: new Prisma.Decimal(50),
              discount: new Prisma.Decimal(0),
              taxAmount: new Prisma.Decimal(0),
              subtotal: new Prisma.Decimal(50),
              total: new Prisma.Decimal(50),
            },
          ],
        },
      },
    });

    const report = await getProductPerformanceReport({ branchId });
    expect(report.length).toBe(2);
    const taxItem = report.find((r) => r.sku === 'PROD-TAX');
    const multiItem = report.find((r) => r.sku === 'PROD-MULTI');

    expect(taxItem?.revenue).toBe('110.00');
    expect(multiItem?.revenue).toBe('50.00');
  });

  // Test 4: Discounts + tax
  it('proportionally allocates document discounts across taxable items', async () => {
    // Item 1: 100 subtotal, 10 tax = 110 total
    // Item 2: 50 subtotal, 0 tax = 50 total
    // Sale subtotal: 150, tax: 10
    // If Document Discount = 32
    // Sale Total = 160 - 32 = 128
    // Proportional Factor = 128 / (150 + 10) = 128 / 160 = 0.8
    // Item 1 adjusted revenue = 110 * 0.8 = 88
    // Item 2 adjusted revenue = 50 * 0.8 = 40
    // Total adjusted revenue = 88 + 40 = 128 (matches Sale Total!)
    await prisma.sale.create({
      data: {
        branchId,
        createdById: cashierId,
        customerId,
        status: SaleStatus.COMPLETED,
        subtotal: new Prisma.Decimal(150),
        discount: new Prisma.Decimal(32),
        taxAmount: new Prisma.Decimal(10),
        total: new Prisma.Decimal(128),
        items: {
          create: [
            {
              productId: pTaxId,
              sku: 'PROD-TAX',
              productName: 'Taxable Product',
              quantity: 1,
              unitPrice: new Prisma.Decimal(100),
              discount: new Prisma.Decimal(0),
              taxAmount: new Prisma.Decimal(10),
              subtotal: new Prisma.Decimal(100),
              total: new Prisma.Decimal(110),
            },
            {
              productId: pMultiId,
              sku: 'PROD-MULTI',
              productName: 'Multi Product',
              quantity: 1,
              unitPrice: new Prisma.Decimal(50),
              discount: new Prisma.Decimal(0),
              taxAmount: new Prisma.Decimal(0),
              subtotal: new Prisma.Decimal(50),
              total: new Prisma.Decimal(50),
            },
          ],
        },
      },
    });

    const report = await getProductPerformanceReport({ branchId });
    expect(report.length).toBe(2);
    const taxItem = report.find((r) => r.sku === 'PROD-TAX');
    const multiItem = report.find((r) => r.sku === 'PROD-MULTI');

    expect(taxItem?.revenue).toBe('88.00');
    expect(multiItem?.revenue).toBe('40.00');
  });

  // Test 5: Zero-tax, full discount edge cases
  it('handles 100% discount edge cases safely', async () => {
    // Item 1: 100 subtotal, 0 tax = 100 total
    // Sale subtotal: 100, tax: 0
    // Document Discount = 100
    // Sale Total = 0
    // Factor = 0 / 100 = 0
    await prisma.sale.create({
      data: {
        branchId,
        createdById: cashierId,
        customerId,
        status: SaleStatus.COMPLETED,
        subtotal: new Prisma.Decimal(100),
        discount: new Prisma.Decimal(100),
        taxAmount: new Prisma.Decimal(0),
        total: new Prisma.Decimal(0),
        items: {
          create: {
            productId: pNoTaxId,
            sku: 'PROD-NOTAX',
            productName: 'No Tax Product',
            quantity: 1,
            unitPrice: new Prisma.Decimal(100),
            discount: new Prisma.Decimal(0),
            taxAmount: new Prisma.Decimal(0),
            subtotal: new Prisma.Decimal(100),
            total: new Prisma.Decimal(100),
          },
        },
      },
    });

    const report = await getProductPerformanceReport({ branchId });
    expect(report.length).toBe(1);
    expect(report[0].revenue).toBe('0.00');
  });

  it('handles zero subtotal/zero tax safely (100% line discount)', async () => {
    // Item 1: 100 price, 100 discount, 0 tax -> subtotal 0, total 0
    // Sale subtotal: 0, tax: 0, total: 0
    await prisma.sale.create({
      data: {
        branchId,
        createdById: cashierId,
        customerId,
        status: SaleStatus.COMPLETED,
        subtotal: new Prisma.Decimal(0),
        discount: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        total: new Prisma.Decimal(0),
        items: {
          create: {
            productId: pNoTaxId,
            sku: 'PROD-NOTAX',
            productName: 'No Tax Product',
            quantity: 1,
            unitPrice: new Prisma.Decimal(100),
            discount: new Prisma.Decimal(100), // 100% line item discount
            taxAmount: new Prisma.Decimal(0),
            subtotal: new Prisma.Decimal(0),
            total: new Prisma.Decimal(0),
          },
        },
      },
    });

    const report = await getProductPerformanceReport({ branchId });
    expect(report.length).toBe(1);
    // Should fallback to total=0 safely since (s.subtotal + s.taxAmount) = 0
    expect(report[0].revenue).toBe('0.00');
  });
});
