import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { requireAuth, requirePermission } from '@/lib/auth/guard';
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

describe('Products API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth/guard')).AuthError('Auth', 401, 'UNAUTHORIZED'));
    const req = new NextRequest('http://localhost:3000/api/v1/products');
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it('rejects invalid query parameters', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);
    const req = new NextRequest('http://localhost:3000/api/v1/products?page=invalid');
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('returns paginated products for authorized users', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);

    const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const sku1 = `TEST-P1-${suffix}`;
    const sku2 = `TEST-P2-${suffix}`;

    // Create test products
    const product1 = await prisma.product.create({
      data: {
        name: `Test Product 1 ${suffix}`,
        sku: sku1,
        sellingPrice: 10.0,
      },
    });

    const product2 = await prisma.product.create({
      data: {
        name: `Test Product 2 ${suffix}`,
        sku: sku2,
        sellingPrice: 20.0,
      },
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/products?query=${suffix}`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.products.length).toBeGreaterThanOrEqual(2);
    expect(body.data.products.some((p: { sku: string }) => p.sku === sku1)).toBe(true);
    expect(body.data.products.some((p: { sku: string }) => p.sku === sku2)).toBe(true);

    // Verify DTO sanitization (should not have createdAt, updatedAt)
    const returnedProduct = body.data.products.find((p: { sku: string }) => p.sku === sku1);
    expect(returnedProduct).not.toHaveProperty('createdAt');
    expect(returnedProduct).not.toHaveProperty('updatedAt');

    // Cleanup
    await prisma.product.deleteMany({
      where: { id: { in: [product1.id, product2.id] } },
    });
  });
});
