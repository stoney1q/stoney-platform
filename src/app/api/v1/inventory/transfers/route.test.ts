import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  default: {
    transfer: {
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
        permissions: ['inventory:read'],
      }),
    requirePermission: vi.fn(),
  };
});

describe('GET /api/v1/inventory/transfers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pending outgoing and in-transit incoming transfers for branch', async () => {
    vi.mocked(prisma.transfer.findMany).mockResolvedValue([
      { id: 't-1', status: 'PENDING' },
      { id: 't-2', status: 'IN_TRANSIT' },
    ] as never);

    const req = new NextRequest('http://localhost/api/v1/inventory/transfers');
    const res = await GET(req, {});

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.outgoing).toHaveLength(1);
    expect(json.data.incoming).toHaveLength(1);
    expect(prisma.transfer.findMany).toHaveBeenCalled();
  });
});
