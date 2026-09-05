import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import prisma from '@/lib/prisma';
import { requireAuth, requirePermission, AuthError } from '@/lib/auth/guard';
import { ProductType, Prisma } from '@/generated/prisma/client';

vi.mock('@/lib/prisma', () => ({
  default: {
    product: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth/guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guard')>();
  return {
    ...actual,
    requireAuth: vi.fn(),
    requirePermission: vi.fn(),
  };
});

describe('Product Detail API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(
      new AuthError('Authentication required.', 401, 'UNAUTHORIZED')
    );

    const req = new NextRequest('http://localhost:3000/api/v1/products/p1');
    const res = await GET(req, { params: Promise.resolve({ id: 'p1' }) });

    expect(res.status).toBe(401);
  });

  it('rejects users without inventory:read permission with 403', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'u1',
      branchId: 'b1',
      role: { name: 'Technician' },
      permissions: [],
    } as unknown as never);
    vi.mocked(requirePermission).mockRejectedValueOnce(
      new AuthError('Access denied.', 403, 'FORBIDDEN')
    );

    const req = new NextRequest('http://localhost:3000/api/v1/products/p1');
    const res = await GET(req, { params: Promise.resolve({ id: 'p1' }) });

    expect(res.status).toBe(403);
  });

  it('returns 400 when product id is empty', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'u1',
      branchId: 'b1',
      role: { name: 'Technician' },
      permissions: ['inventory:read'],
    } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValueOnce({} as unknown as never);

    const req = new NextRequest('http://localhost:3000/api/v1/products/');
    const res = await GET(req, { params: Promise.resolve({ id: '' }) });

    expect(res.status).toBe(400);
  });

  it('returns 404 when product is not found', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'u1',
      branchId: 'b1',
      role: { name: 'Technician' },
      permissions: ['inventory:read'],
    } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValueOnce({} as unknown as never);
    vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(null);

    const req = new NextRequest(
      'http://localhost:3000/api/v1/products/p-missing'
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: 'p-missing' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Product not found');
  });

  it('returns product details with branch stock', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'u1',
      branchId: 'b1',
      role: { name: 'Technician' },
      permissions: ['inventory:read'],
    } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValueOnce({} as unknown as never);

    vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
      id: 'p1',
      sku: 'TEST-SKU',
      name: 'Test Screen',
      description: 'Screen description',
      type: ProductType.GOODS,
      sellingPrice: new Prisma.Decimal('199.99'),
      categoryId: 'c1',
      brandId: 'b1',
      category: {
        id: 'c1',
        name: 'Screens',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      brand: {
        id: 'b1',
        name: 'Samsung',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      branchStocks: [
        {
          id: 'bs1',
          branchId: 'b1',
          productId: 'p1',
          onHand: 15,
          reserved: 3,
          reorderLevel: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as never);

    const req = new NextRequest('http://localhost:3000/api/v1/products/p1');
    const res = await GET(req, { params: Promise.resolve({ id: 'p1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.product).toEqual({
      id: 'p1',
      sku: 'TEST-SKU',
      name: 'Test Screen',
      description: 'Screen description',
      type: 'GOODS',
      sellingPrice: '199.99',
      category: 'Screens',
      brand: 'Samsung',
      stock: {
        branchId: 'b1',
        onHand: 15,
        reserved: 3,
        available: 12,
      },
    });
  });

  it('defaults stock to 0 if no BranchStock record exists for the branch', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'u1',
      branchId: 'b1',
      role: { name: 'Technician' },
      permissions: ['inventory:read'],
    } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValueOnce({} as unknown as never);

    vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
      id: 'p2',
      sku: 'NO-STOCK-SKU',
      name: 'Service Fee',
      description: null,
      type: ProductType.SERVICE,
      sellingPrice: new Prisma.Decimal('50.00'),
      categoryId: null,
      brandId: null,
      category: null,
      brand: null,
      branchStocks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as never);

    const req = new NextRequest('http://localhost:3000/api/v1/products/p2');
    const res = await GET(req, { params: Promise.resolve({ id: 'p2' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.product.stock).toEqual({
      branchId: 'b1',
      onHand: 0,
      reserved: 0,
      available: 0,
    });
  });
});
