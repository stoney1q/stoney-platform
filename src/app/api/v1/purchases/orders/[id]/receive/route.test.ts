import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { receivePurchaseOrder } from '@/lib/purchases/actions';

vi.mock('@/lib/purchases/actions', () => ({
  receivePurchaseOrder: vi.fn(),
}));
vi.mock('@/lib/api/rate-limit', () => ({
  checkRateLimit: vi.fn(() => true),
}));
vi.mock('@/lib/auth/guard', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    requireAuth: vi.fn().mockResolvedValue({ id: 'user-1' }),
  };
});

describe('POST /api/v1/purchases/orders/[id]/receive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('receives purchase order successfully', async () => {
    vi.mocked(receivePurchaseOrder).mockResolvedValue({
      success: true,
      data: { id: 'po-1' },
      error: undefined,
    } as never);

    const req = new NextRequest(
      'http://localhost/api/v1/purchases/orders/po-1/receive',
      {
        method: 'POST',
        body: JSON.stringify({
          items: [{ itemId: 'item-1', quantity: 10 }],
        }),
      }
    );

    const res = await POST(req, { params: { id: 'po-1' } } as unknown as never);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.order.id).toBe('po-1');
    expect(receivePurchaseOrder).toHaveBeenCalledWith('po-1', {
      items: [{ itemId: 'item-1', quantity: 10 }],
    });
  });

  it('handles action failure', async () => {
    vi.mocked(receivePurchaseOrder).mockResolvedValue({
      success: false,
      error: 'Cannot receive',
      data: undefined,
    } as never);

    const req = new NextRequest(
      'http://localhost/api/v1/purchases/orders/po-1/receive',
      {
        method: 'POST',
        body: JSON.stringify({
          items: [{ itemId: 'item-1', quantity: 10 }],
        }),
      }
    );

    const res = await POST(req, { params: { id: 'po-1' } } as unknown as never);
    expect(res.status).toBe(400);
  });
});
