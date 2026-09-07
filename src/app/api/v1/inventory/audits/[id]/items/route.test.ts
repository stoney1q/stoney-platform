import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { upsertAuditItem } from '@/lib/inventory/audit-actions';

vi.mock('@/lib/inventory/audit-actions', () => ({
  upsertAuditItem: vi.fn(),
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

describe('POST /api/v1/inventory/audits/[id]/items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts audit item successfully', async () => {
    vi.mocked(upsertAuditItem).mockResolvedValue({
      id: 'item-1',
      countedQuantity: 5,
    } as never);

    const req = new NextRequest(
      'http://localhost/api/v1/inventory/audits/audit-1/items',
      {
        method: 'POST',
        body: JSON.stringify({
          productId: 'prod-1',
          quantity: 5,
          mode: 'increment',
        }),
      }
    );

    const res = await POST(req, { params: { id: 'audit-1' } });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.item.id).toBe('item-1');
    expect(upsertAuditItem).toHaveBeenCalledWith(
      'audit-1',
      'prod-1',
      5,
      'increment'
    );
  });

  it('fails with validation error for invalid body', async () => {
    const req = new NextRequest(
      'http://localhost/api/v1/inventory/audits/audit-1/items',
      {
        method: 'POST',
        body: JSON.stringify({
          productId: 'prod-1',
          quantity: 'not-a-number',
        }),
      }
    );

    const res = await POST(req, { params: { id: 'audit-1' } });
    expect(res.status).toBe(400);
  });
});
