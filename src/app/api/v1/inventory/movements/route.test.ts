import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { requireAuth, requirePermission, requireBranchAccess } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { MovementType } from '@/generated/prisma/client';

vi.mock('@/lib/auth/guard', async () => {
  return {
    requireAuth: vi.fn(),
    requirePermission: vi.fn(),
    requireBranchAccess: vi.fn(),
    AuthError: class AuthError extends Error {
      constructor(message: string, public statusCode: number, public code: string) {
        super(message);
      }
    },
  };
});

describe('Inventory Movements API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth/guard')).AuthError('Auth', 401, 'UNAUTHORIZED'));
    const req = new NextRequest('http://localhost:3000/api/v1/inventory/movements?branchId=b1');
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it('rejects user without branch assignment', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1', role: { name: 'User' }, permissions: [] } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);
    const req = new NextRequest('http://localhost:3000/api/v1/inventory/movements');
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('rejects access to unauthorized branch', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1', branchId: 'b1', role: { name: 'User' }, permissions: [] } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);
    vi.mocked(requireBranchAccess).mockRejectedValue(new (await import('@/lib/auth/guard')).AuthError('Access denied', 403, 'FORBIDDEN'));
    const req = new NextRequest('http://localhost:3000/api/v1/inventory/movements?branchId=branch-2');
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it('returns paginated movements', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const branch = await prisma.branch.create({
      data: {
        name: `Branch Mov ${suffix}`,
        code: `TB-MOV-${suffix}`,
      },
    });

    const role = await prisma.role.create({
      data: {
        name: `Role Mov ${suffix}`,
      },
    });

    const user = await prisma.user.create({
      data: {
        firstName: `Test`,
        lastName: `User`,
        email: `mov-user-${suffix}@example.com`,
        role: { connect: { id: role.id } },
        branch: { connect: { id: branch.id } },
      },
    });

    const product = await prisma.product.create({
      data: {
        name: `Product Mov ${suffix}`,
        sku: `SKU-MOV-${suffix}`,
      },
    });

    await prisma.stockMovement.create({
      data: {
        branchId: branch.id,
        productId: product.id,
        quantity: 10,
        type: MovementType.RECEIPT,
        userId: user.id,
      },
    });

    vi.mocked(requireAuth).mockResolvedValue({
      id: user.id,
      branchId: branch.id,
      role: { name: 'User' },
      permissions: [],
    } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);
    vi.mocked(requireBranchAccess).mockResolvedValue({} as unknown as never);

    const req = new NextRequest(`http://localhost:3000/api/v1/inventory/movements`);
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.movements.length).toBeGreaterThanOrEqual(1);
    const returnedMovement = body.data.movements.find((m: { productId: string }) => m.productId === product.id);
    expect(returnedMovement).toBeDefined();

    // Ensure userId is stripped
    expect(returnedMovement).not.toHaveProperty('userId');
    expect(returnedMovement).toHaveProperty('productName', product.name);

    // Cleanup
    await prisma.stockMovement.deleteMany({ where: { branchId: branch.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.role.delete({ where: { id: role.id } });
    await prisma.branch.delete({ where: { id: branch.id } });
  });
});
