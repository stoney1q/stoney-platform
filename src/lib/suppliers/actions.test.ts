import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as actions from './actions';
import * as service from './service';

vi.mock('./service', () => ({
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
  deleteSupplier: vi.fn(),
  getSupplier: vi.fn(),
  searchSuppliers: vi.fn(),
  linkProductToSupplier: vi.fn(),
  unlinkProductFromSupplier: vi.fn(),
}));

describe('Supplier Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSupplier', () => {
    it('returns success when service succeeds', async () => {
      const mockSupplier = { id: '1', name: 'Acme Corp' };
      vi.mocked(service.createSupplier).mockResolvedValue(
        mockSupplier as never
      );

      const result = await actions.createSupplier({ name: 'Acme Corp' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSupplier);
      expect(result.error).toBeUndefined();
    });

    it('returns error when validation fails', async () => {
      const result = await actions.createSupplier({ name: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Name is required');
    });

    it('returns error when service throws', async () => {
      vi.mocked(service.createSupplier).mockRejectedValue(
        new Error('Auth failed')
      );
      const result = await actions.createSupplier({ name: 'Acme Corp' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Auth failed');
    });
  });

  describe('linkProductToSupplier', () => {
    it('returns error when unit cost is negative', async () => {
      const result = await actions.linkProductToSupplier({
        productId: 'p1',
        supplierId: 's1',
        unitCost: '-5',
        isPreferred: false,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Unit cost must be a valid positive number'
      );
    });

    it('returns error when unit cost is invalid string', async () => {
      const result = await actions.linkProductToSupplier({
        productId: 'p1',
        supplierId: 's1',
        unitCost: 'abc',
        isPreferred: false,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Unit cost must be a valid positive number'
      );
    });

    it('returns success when service succeeds with string decimal', async () => {
      vi.mocked(service.linkProductToSupplier).mockResolvedValue({} as never);
      const result = await actions.linkProductToSupplier({
        productId: 'p1',
        supplierId: 's1',
        unitCost: '10.50',
        isPreferred: false,
      });
      expect(result.success).toBe(true);
    });

    it('returns success when service succeeds with number', async () => {
      vi.mocked(service.linkProductToSupplier).mockResolvedValue({} as never);
      const result = await actions.linkProductToSupplier({
        productId: 'p1',
        supplierId: 's1',
        unitCost: '10',
        isPreferred: false,
      });
      expect(result.success).toBe(true);
    });
  });
});
