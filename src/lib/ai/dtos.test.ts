import { describe, it, expect } from 'vitest';
import { toSafeInventoryDTO, toSafeRepairDTO } from './dtos';

describe('AI Safe DTOs', () => {
  it('should strip sensitive fields from inventory', () => {
    const rawProduct = {
      id: 'prod_123',
      name: 'iPhone Screen',
      sku: 'IPH-SCR-01',
      unitCost: 50.0, // SENSITIVE
      categoryId: 'cat_123',
      supplierId: 'supp_123', // SENSITIVE
      category: { name: 'Parts' },
      brand: { name: 'Apple' },
    };

    const rawBranchStock = {
      onHand: 10,
      reorderLevel: 5,
    };

    const safe = toSafeInventoryDTO(rawProduct, rawBranchStock);

    expect(safe).toEqual({
      id: 'prod_123',
      name: 'iPhone Screen',
      sku: 'IPH-SCR-01',
      stockLevel: 10,
      lowStockThreshold: 5,
      category: 'Parts',
      brand: 'Apple',
    });

    // Explicitly verify they are missing
    expect('unitCost' in safe).toBe(false);
    expect('supplierId' in safe).toBe(false);
  });

  it('should strip sensitive fields from repairs', () => {
    const rawRepair = {
      id: 'rep_123',
      sequence: 1001,
      status: 'IN_PROGRESS',
      issue: 'Broken screen',
      notes: 'Customer dropped it',
      createdAt: new Date('2023-01-01T00:00:00Z'),
      customer: { // SENSITIVE
        firstName: 'John',
        lastName: 'Doe',
        phone: '555-1234',
      },
      device: {
        model: 'iPhone 13',
      },
      technicianId: 'user_123', // SENSITIVE
    };

    const safe = toSafeRepairDTO(rawRepair);

    expect(safe).toEqual({
      id: 'rep_123',
      sequence: 1001,
      status: 'IN_PROGRESS',
      deviceModel: 'iPhone 13',
      reportedIssue: 'Broken screen',
      notes: 'Customer dropped it',
      createdAt: '2023-01-01T00:00:00.000Z',
      completedAt: undefined,
    });

    // Explicitly verify they are missing
    expect('customer' in safe).toBe(false);
    expect('technicianId' in safe).toBe(false);
  });
});
