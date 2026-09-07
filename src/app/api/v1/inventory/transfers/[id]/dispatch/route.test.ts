import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { dispatchTransfer } from '@/lib/inventory/actions';

vi.mock('@/lib/inventory/actions', () => ({
  dispatchTransfer: vi.fn(),
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

describe('POST /api/v1/inventory/transfers/[id]/dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches transfer successfully', async () => {
    vi.mocked(dispatchTransfer).mockResolvedValue({
      id: 't-1',
      status: 'IN_TRANSIT',
    } as never);

    const req = new NextRequest(
      'http://localhost/api/v1/inventory/transfers/t-1/dispatch',
      {
        method: 'POST',
      }
    );

    const res = await POST(req, { params: { id: 't-1' } });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.transfer.id).toBe('t-1');
    expect(dispatchTransfer).toHaveBeenCalledWith('t-1');
  });
});
