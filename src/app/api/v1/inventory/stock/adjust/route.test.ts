import { describe, beforeEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { adjustStock } from '@/lib/inventory/actions';
import { requireAuth } from '@/lib/auth/guard';

vi.mock('@/lib/inventory/actions', () => ({
  adjustStock: vi.fn(),
}));

vi.mock('@/lib/auth/guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guard')>();
  return {
    ...actual,
    requireAuth: vi.fn(),
    requirePermission: vi.fn(),
    requireBranchAccess: vi.fn(),
  };
});

describe('POST /api/v1/inventory/stock/adjust', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'user-1',
      branchId: 'branch-1',
    } as never);
  });

  it('validates schema successfully and creates adjustment', async () => {
    const mockStock = {
      id: 'stock-1',
      branchId: 'branch-1',
      productId: 'prod-1',
      onHand: 8,
      reserved: 0,
    };
    vi.mocked(adjustStock).mockResolvedValue(mockStock as never);

    const req = new NextRequest(
      'http://localhost/api/v1/inventory/stock/adjust',
      {
        method: 'POST',
        body: JSON.stringify({
          branchId: 'branch-1',
          productId: 'prod-1',
          quantity: -2,
          reason: 'Cycle count discrepancy',
        }),
      }
    );

    const res = await POST(req, { params: {} } as unknown as {
      params: Record<string, unknown>;
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.id).toBe('stock-1');
    expect(adjustStock).toHaveBeenCalledWith(
      'branch-1',
      'prod-1',
      -2,
      'Cycle count discrepancy'
    );
  });

  it('rejects zero quantity', async () => {
    const req = new NextRequest(
      'http://localhost/api/v1/inventory/stock/adjust',
      {
        method: 'POST',
        body: JSON.stringify({
          branchId: 'branch-1',
          productId: 'prod-1',
          quantity: 0,
          reason: 'Zero adjust',
        }),
      }
    );

    const res = await POST(req, { params: {} } as unknown as {
      params: Record<string, unknown>;
    });
    expect(res.status).toBe(400);
  });
});
