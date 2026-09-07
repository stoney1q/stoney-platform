import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { getAudits } from '@/lib/inventory/audit-actions';

vi.mock('@/lib/inventory/audit-actions', () => ({
  getAudits: vi.fn(),
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

describe('GET /api/v1/inventory/audits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns audits array', async () => {
    vi.mocked(getAudits).mockResolvedValue([
      { id: 'audit-1', status: 'IN_PROGRESS' },
    ] as never);

    const req = new NextRequest('http://localhost/api/v1/inventory/audits');
    const res = await GET(req, {});

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.audits).toHaveLength(1);
    expect(json.data.audits[0].id).toBe('audit-1');
  });
});
