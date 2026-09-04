import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { requireAuth, requirePermission } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';

vi.mock('@/lib/auth/guard', async () => {
  return {
    requireAuth: vi.fn(),
    requirePermission: vi.fn(),
    AuthError: class AuthError extends Error {
      constructor(message: string, public statusCode: number, public code: string) {
        super(message);
      }
    },
  };
});

describe('Branches API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth/guard')).AuthError('Auth', 401, 'UNAUTHORIZED'));
    const req = new NextRequest('http://localhost:3000/api/v1/branches');
    const res = await GET(req, {});
    expect(res.status).toBe(401);
  });

  it('rejects invalid query parameters', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1', role: { name: 'User' }, permissions: [] } as unknown as never);
    const req = new NextRequest('http://localhost:3000/api/v1/branches?page=invalid');
    const res = await GET(req, {});
    expect(res.status).toBe(400);
  });

  it('returns active branches for authenticated users', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1', role: { name: 'User' }, permissions: [] } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);

    const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const branch = await prisma.branch.create({
      data: {
        name: `Test Branch API ${suffix}`,
        code: `TB-BR-${suffix}`,
        isActive: true,
      },
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/branches?query=${branch.code}`);
    const res = await GET(req, {});

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.branches.length).toBeGreaterThanOrEqual(1);
    expect(body.data.branches.some((b: { code: string }) => b.code === branch.code)).toBe(true);

    // Verify DTO sanitization
    const returnedBranch = body.data.branches.find((b: { code: string }) => b.code === branch.code);
    expect(returnedBranch).not.toHaveProperty('createdAt');
    expect(returnedBranch).not.toHaveProperty('updatedAt');

    // Cleanup
    await prisma.branch.delete({ where: { id: branch.id } });
  });
});
