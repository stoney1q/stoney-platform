import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as service from './service';
import prisma from '../prisma';
import { requirePermission } from '../auth/guard';

vi.mock('../prisma', () => ({
  default: {
    supplier: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    productSupplier: {
      upsert: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => {
      return await cb(prisma);
    }),
  },
}));

vi.mock('../auth/guard', () => ({
  requirePermission: vi.fn(),
}));

describe('Supplier Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSupplier', () => {
    it('requires suppliers:create permission', async () => {
      await service.createSupplier({ name: 'Acme Corp' });
      expect(requirePermission).toHaveBeenCalledWith('suppliers:create');
    });

    it('creates a supplier in the database', async () => {
      const data = {
        name: 'Acme Corp',
        contactName: 'John',
        email: 'john@acme.com',
        phone: '123',
      };
      await service.createSupplier(data);
      expect(prisma.supplier.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('updateSupplier', () => {
    it('requires suppliers:update permission', async () => {
      await service.updateSupplier('1', { name: 'Acme Corp' });
      expect(requirePermission).toHaveBeenCalledWith('suppliers:update');
    });
  });

  describe('deleteSupplier', () => {
    it('requires suppliers:delete permission', async () => {
      await service.deleteSupplier('1');
      expect(requirePermission).toHaveBeenCalledWith('suppliers:delete');
    });
  });

  describe('getSupplier', () => {
    it('requires suppliers:read permission', async () => {
      await service.getSupplier('1');
      expect(requirePermission).toHaveBeenCalledWith('suppliers:read');
    });
  });

  describe('searchSuppliers', () => {
    it('requires suppliers:read permission', async () => {
      vi.mocked(prisma.supplier.count).mockResolvedValue(0);
      vi.mocked(prisma.supplier.findMany).mockResolvedValue([]);
      await service.searchSuppliers({});
      expect(requirePermission).toHaveBeenCalledWith('suppliers:read');
    });
  });

  describe('linkProductToSupplier', () => {
    it('requires suppliers:update permission', async () => {
      await service.linkProductToSupplier({
        productId: 'p1',
        supplierId: 's1',
        unitCost: '10',
        isPreferred: false,
        supplierSku: null,
      });
      expect(requirePermission).toHaveBeenCalledWith('suppliers:update');
      expect(prisma.productSupplier.upsert).toHaveBeenCalled();
    });

    it('uses transaction when isPreferred is true', async () => {
      await service.linkProductToSupplier({
        productId: 'p1',
        supplierId: 's1',
        unitCost: '10',
        isPreferred: true,
        supplierSku: null,
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.productSupplier.updateMany).toHaveBeenCalledWith({
        where: { productId: 'p1' },
        data: { isPreferred: false },
      });
      expect(prisma.productSupplier.upsert).toHaveBeenCalled();
    });
  });

  describe('unlinkProductFromSupplier', () => {
    it('requires suppliers:update permission', async () => {
      await service.unlinkProductFromSupplier('p1', 's1');
      expect(requirePermission).toHaveBeenCalledWith('suppliers:update');
      expect(prisma.productSupplier.delete).toHaveBeenCalledWith({
        where: { productId_supplierId: { productId: 'p1', supplierId: 's1' } },
      });
    });
  });
});
