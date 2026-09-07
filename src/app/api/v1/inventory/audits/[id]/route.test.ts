import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { getAuditById } from '@/lib/inventory/audit-actions';

vi.mock('@/lib/inventory/audit-actions', () => ({
  getAuditById: vi.fn(),
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

describe('GET /api/v1/inventory/audits/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns audit detail', async () => {
    vi.mocked(getAuditById).mockResolvedValue({
      id: 'audit-1',
      status: 'IN_PROGRESS',
    } as never);

    const req = new NextRequest(
      'http://localhost/api/v1/inventory/audits/audit-1'
    );
    const res = await GET(req, { params: { id: 'audit-1' } });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.audit.id).toBe('audit-1');
  });

  it('returns 404 if not found', async () => {
    vi.mocked(getAuditById).mockResolvedValue(null);

    const req = new NextRequest(
      'http://localhost/api/v1/inventory/audits/audit-999'
    );
    const res = await GET(req, { params: { id: 'audit-999' } });

    expect(res.status).toBe(404);
  });
});
