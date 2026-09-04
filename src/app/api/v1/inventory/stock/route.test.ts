import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { requireAuth, requirePermission, requireBranchAccess } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';

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

describe('Inventory Stock API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth/guard')).AuthError('Auth', 401, 'UNAUTHORIZED'));
    const req = new NextRequest('http://localhost:3000/api/v1/inventory/stock?branchId=b1');
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it('rejects user without branch assignment', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1', role: { name: 'User' }, permissions: [] } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);
    const req = new NextRequest('http://localhost:3000/api/v1/inventory/stock');
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('rejects access to unauthorized branch', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1', branchId: 'b1', role: { name: 'User' }, permissions: [] } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);
    vi.mocked(requireBranchAccess).mockRejectedValue(new (await import('@/lib/auth/guard')).AuthError('Access denied', 403, 'FORBIDDEN'));
    const req = new NextRequest('http://localhost:3000/api/v1/inventory/stock?branchId=branch-2');
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it('returns paginated stock for authorized users', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const branch = await prisma.branch.create({
      data: {
        name: `Branch Stock ${suffix}`,
        code: `TB-ST-${suffix}`,
      },
    });

    const product = await prisma.product.create({
      data: {
        name: `Product Stock ${suffix}`,
        sku: `SKU-ST-${suffix}`,
        sellingPrice: 10.0,
      },
    });

    await prisma.branchStock.create({
      data: {
        branchId: branch.id,
        productId: product.id,
        onHand: 50,
      },
    });

    vi.mocked(requireAuth).mockResolvedValue({
      id: 'user-1',
      branchId: branch.id,
      role: { name: 'User' },
      permissions: [],
    } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);
    vi.mocked(requireBranchAccess).mockResolvedValue({} as unknown as never);

    const req = new NextRequest(`http://localhost:3000/api/v1/inventory/stock?query=${suffix}`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.stock.length).toBeGreaterThanOrEqual(1);
    expect(body.data.stock.some((s: { productId: string }) => s.productId === product.id)).toBe(true);

    // Verify DTO sanitization
    const returnedStock = body.data.stock.find((s: { productId: string }) => s.productId === product.id);
    expect(returnedStock).not.toHaveProperty('createdAt');
    expect(returnedStock).not.toHaveProperty('updatedAt');
    expect(returnedStock).toHaveProperty('productName', product.name);
    expect(returnedStock).toHaveProperty('sku', product.sku);

    // Cleanup
    await prisma.branchStock.deleteMany({ where: { branchId: branch.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.branch.delete({ where: { id: branch.id } });
  });
});
