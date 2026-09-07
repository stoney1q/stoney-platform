import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { PurchaseOrderStatus } from '@/generated/prisma/client';

vi.mock('@/lib/prisma', () => ({
  default: {
    purchaseOrder: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/api/rate-limit', () => ({
  checkRateLimit: vi.fn(() => true),
}));
vi.mock('@/lib/auth/guard', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    requireAuth: vi
      .fn()
      .mockResolvedValue({
        id: 'user-1',
        branchId: 'branch-1',
        role: { name: 'Staff' },
        permissions: ['purchases:read'],
      }),
    requirePermission: vi.fn(),
  };
});

describe('GET /api/v1/purchases/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pending purchase orders for branch', async () => {
    vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([
      { id: 'po-1' },
    ] as never);

    const req = new NextRequest('http://localhost/api/v1/purchases/orders');
    const res = await GET(req, {});

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.orders).toHaveLength(1);
    expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: 'branch-1',
          status: {
            in: [
              PurchaseOrderStatus.ORDERED,
              PurchaseOrderStatus.PARTIALLY_RECEIVED,
            ],
          },
        },
      })
    );
  });
});
