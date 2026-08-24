import 'dotenv/config';
import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest';
import * as assert from 'node:assert';
import { QuotationStatus, ProductType } from '@/generated/prisma/client';
import {
  createQuotation,
  addQuotationItem,
  updateQuotationStatus,
  convertQuotationToSale,
} from './actions';
import { prisma } from '@/lib/prisma';
import * as authGuard from '@/lib/auth/guard';

vi.mock('@/lib/auth/guard', () => ({
  requireAuth: vi.fn(),
  requirePermission: vi.fn(),
  requireBranchAccess: vi.fn(),
}));

describe('Quotations Actions', () => {
  let mockUserId = '';
  let mockBranchId = '';
  let mockRoleId = '';
  let mockCustomerId = '';
  let mockProductId = '';

  beforeEach(async () => {
    vi.resetAllMocks();

    // Default mocks
    mockUserId = `user_${Date.now()}_${Math.random()}`;
    mockBranchId = `branch_${Date.now()}_${Math.random()}`;
    mockRoleId = `role_${Date.now()}_${Math.random()}`;
    mockCustomerId = `customer_${Date.now()}_${Math.random()}`;
    mockProductId = `product_${Date.now()}_${Math.random()}`;

    vi.mocked(authGuard.requireAuth).mockResolvedValue({
      id: mockUserId,
      branchId: mockBranchId,
      roleId: mockRoleId,
      email: 'test@test.com',
      firstName: 'Test',
      lastName: 'User',
      emailVerified: true,
      isActive: true,
      firebaseUid: 'fb-123',
      phone: null,
      avatar: null,
    } as never);
    vi.mocked(authGuard.requirePermission).mockResolvedValue({
      id: mockUserId,
      branchId: mockBranchId,
      roleId: mockRoleId,
      email: 'test@test.com',
      firstName: 'Test',
      lastName: 'User',
      emailVerified: true,
      isActive: true,
      firebaseUid: 'fb-123',
      phone: null,
      avatar: null,
    } as never);
    vi.mocked(authGuard.requireBranchAccess).mockResolvedValue(
      undefined as never
    );

    // Setup DB
    // Clean up anything associated with these unique IDs (in case of a test failure leaving dirty state, though usually afterEach handles it)
    await prisma.quotationItem.deleteMany({
      where: { quotation: { branchId: mockBranchId } },
    });
    await prisma.quotation.deleteMany({ where: { branchId: mockBranchId } });
    await prisma.sale.deleteMany({ where: { branchId: mockBranchId } });
    await prisma.customer.deleteMany({ where: { id: mockCustomerId } });
    await prisma.product.deleteMany({ where: { id: mockProductId } });
    await prisma.user.deleteMany({ where: { id: mockUserId } });
    await prisma.role.deleteMany({ where: { id: mockRoleId } });
    await prisma.branch.deleteMany({ where: { id: mockBranchId } });

    await prisma.branch.create({
      data: {
        id: mockBranchId,
        name: 'Test Branch',
        code: `TEST_BR_${Date.now()}_${Math.random()}`,
      },
    });

    await prisma.role.create({
      data: {
        id: mockRoleId,
        name: `Test Role ${Date.now()}_${Math.random()}`,
      },
    });

    await prisma.user.create({
      data: {
        id: mockUserId,
        firstName: 'Admin',
        lastName: 'User',
        email: `admin_${Date.now()}@test.com`,
        branchId: mockBranchId,
        roleId: mockRoleId,
      },
    });

    await prisma.customer.create({
      data: {
        id: mockCustomerId,
        firstName: 'Test',
        lastName: 'Customer',
        createdById: mockUserId,
      },
    });

    await prisma.product.create({
      data: {
        id: mockProductId,
        sku: `TEST-SKU-${Date.now()}`,
        name: 'Test Product',
        type: ProductType.GOODS,
        sellingPrice: 100,
      },
    });
  });

  afterEach(async () => {
    await prisma.quotationItem.deleteMany({
      where: { quotation: { branchId: mockBranchId } },
    });
    await prisma.quotation.deleteMany({ where: { branchId: mockBranchId } });
    await prisma.saleItem.deleteMany({
      where: { sale: { branchId: mockBranchId } },
    });
    await prisma.sale.deleteMany({ where: { branchId: mockBranchId } });
    await prisma.customer.deleteMany({ where: { id: mockCustomerId } });
    await prisma.product.deleteMany({ where: { id: mockProductId } });
    await prisma.user.deleteMany({ where: { id: mockUserId } });
    await prisma.role.deleteMany({ where: { id: mockRoleId } });
    await prisma.branch.deleteMany({ where: { id: mockBranchId } });
  });

  describe('createQuotation', () => {
    it('creates a new draft quotation', async () => {
      const formData = new FormData();
      formData.append('customerId', mockCustomerId);

      const quotation = await createQuotation(formData);

      expect(quotation).toBeDefined();
      expect(quotation.status).toBe(QuotationStatus.DRAFT);
      expect(quotation.customerId).toBe(mockCustomerId);
      expect(quotation.branchId).toBe(mockBranchId);
      expect(quotation.subtotal.toString()).toBe('0');
    });
  });

  describe('convertQuotationToSale', () => {
    it('successfully converts an accepted quotation to a sale', async () => {
      // Setup
      const formData = new FormData();
      formData.append('customerId', mockCustomerId);
      const quotation = await createQuotation(formData);

      const addFormData = new FormData();
      addFormData.append('quotationId', quotation.id);
      addFormData.append('productId', mockProductId);
      addFormData.append('quantity', '2');
      addFormData.append('discount', '10');

      await addQuotationItem(addFormData);

      // Approve
      const updateFormData = new FormData();
      updateFormData.append('quotationId', quotation.id);
      updateFormData.append('status', QuotationStatus.ACCEPTED);
      await updateQuotationStatus(updateFormData);

      // Convert
      const convertFormData = new FormData();
      convertFormData.append('quotationId', quotation.id);
      const sale = await convertQuotationToSale(convertFormData);

      // Verify Sale
      expect(sale).toBeDefined();
      expect(sale.quotationId).toBe(quotation.id);
      expect(sale.subtotal.toString()).toBe('190'); // sum(lineTotal)
      expect(sale.total.toString()).toBe('190'); // saleSubtotal - saleDiscount

      // Verify Quotation is converted
      const updatedQuotation = await prisma.quotation.findUnique({
        where: { id: quotation.id },
      });
      expect(updatedQuotation?.status).toBe(QuotationStatus.CONVERTED);
    });

    it('fails to convert a draft quotation', async () => {
      const formData = new FormData();
      formData.append('customerId', mockCustomerId);
      const quotation = await createQuotation(formData);

      const convertFormData = new FormData();
      convertFormData.append('quotationId', quotation.id);

      await assert.rejects(
        convertQuotationToSale(convertFormData),
        /Only ACCEPTED quotations can be converted/
      );
    });
  });
});
