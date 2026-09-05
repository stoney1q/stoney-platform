import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { requireAuth, requireBranchAccess } from '@/lib/auth/guard';
import { prisma } from '@/lib/prisma';
import { addSaleItem } from '@/lib/sales/actions';
import { SaleStatus } from '@/generated/prisma/client';

vi.mock('@/lib/auth/guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guard')>();
  return {
    ...actual,
    requireAuth: vi.fn(),
    requireBranchAccess: vi.fn(),
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    sale: {
      findUnique: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/sales/actions', () => ({
  addSaleItem: vi.fn(),
}));

describe('POST /api/v1/sales/[id]/items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const { AuthError } = await import('@/lib/auth/guard');
    vi.mocked(requireAuth).mockRejectedValueOnce(
      new AuthError('Authentication required.', 401, 'UNAUTHORIZED')
    );

    const req = new NextRequest('http://localhost/api/v1/sales/sale-1/items', {
      method: 'POST',
      body: JSON.stringify({ productId: 'prod-1', quantity: 1 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(401);
  });

  it('rejects users without sales:create or sales:update permission with 403', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'u-1',
      firebaseUid: 'fb-1',
      email: 'cashier@stoney.com',
      firstName: 'Cashier',
      lastName: 'User',
      phone: null,
      avatar: null,
      emailVerified: true,
      isActive: true,
      role: { id: 'r-1', name: 'Cashier', description: null },
      roleId: 'r-1',
      branchId: 'b-1',
      branch: { id: 'b-1', name: 'Main', code: 'MAIN', isActive: true },
      permissions: ['repairs:read'],
    });

    const req = new NextRequest('http://localhost/api/v1/sales/sale-1/items', {
      method: 'POST',
      body: JSON.stringify({ productId: 'prod-1', quantity: 1 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(403);
  });

  it('rejects cross-branch access with 403', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'u-1',
      firebaseUid: 'fb-1',
      email: 'cashier@stoney.com',
      firstName: 'Cashier',
      lastName: 'User',
      phone: null,
      avatar: null,
      emailVerified: true,
      isActive: true,
      role: { id: 'r-1', name: 'Cashier', description: null },
      roleId: 'r-1',
      branchId: 'b-1',
      branch: { id: 'b-1', name: 'Main', code: 'MAIN', isActive: true },
      permissions: ['sales:create'],
    });

    vi.mocked(prisma.sale.findUnique).mockResolvedValueOnce({
      id: 'sale-1',
      branchId: 'b-2',
      status: SaleStatus.PENDING,
    } as never);

    const { AuthError } = await import('@/lib/auth/guard');
    vi.mocked(requireBranchAccess).mockRejectedValueOnce(
      new AuthError('Access denied.', 403, 'FORBIDDEN')
    );

    const req = new NextRequest('http://localhost/api/v1/sales/sale-1/items', {
      method: 'POST',
      body: JSON.stringify({ productId: 'prod-1', quantity: 1 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(403);
  });

  it('returns 404 when sale is not found', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'u-1',
      firebaseUid: 'fb-1',
      email: 'cashier@stoney.com',
      firstName: 'Cashier',
      lastName: 'User',
      phone: null,
      avatar: null,
      emailVerified: true,
      isActive: true,
      role: { id: 'r-1', name: 'Cashier', description: null },
      roleId: 'r-1',
      branchId: 'b-1',
      branch: { id: 'b-1', name: 'Main', code: 'MAIN', isActive: true },
      permissions: ['sales:create'],
    });

    vi.mocked(prisma.sale.findUnique).mockResolvedValueOnce(null);

    const req = new NextRequest(
      'http://localhost/api/v1/sales/sale-missing/items',
      {
        method: 'POST',
        body: JSON.stringify({ productId: 'prod-1', quantity: 1 }),
      }
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: 'sale-missing' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when sale is not in PENDING status', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'u-1',
      firebaseUid: 'fb-1',
      email: 'cashier@stoney.com',
      firstName: 'Cashier',
      lastName: 'User',
      phone: null,
      avatar: null,
      emailVerified: true,
      isActive: true,
      role: { id: 'r-1', name: 'Cashier', description: null },
      roleId: 'r-1',
      branchId: 'b-1',
      branch: { id: 'b-1', name: 'Main', code: 'MAIN', isActive: true },
      permissions: ['sales:create'],
    });

    vi.mocked(prisma.sale.findUnique).mockResolvedValueOnce({
      id: 'sale-1',
      branchId: 'b-1',
      status: SaleStatus.COMPLETED,
    } as never);

    const req = new NextRequest('http://localhost/api/v1/sales/sale-1/items', {
      method: 'POST',
      body: JSON.stringify({ productId: 'prod-1', quantity: 1 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('pending');
  });

  it('returns 404 when product is not found', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'u-1',
      firebaseUid: 'fb-1',
      email: 'cashier@stoney.com',
      firstName: 'Cashier',
      lastName: 'User',
      phone: null,
      avatar: null,
      emailVerified: true,
      isActive: true,
      role: { id: 'r-1', name: 'Cashier', description: null },
      roleId: 'r-1',
      branchId: 'b-1',
      branch: { id: 'b-1', name: 'Main', code: 'MAIN', isActive: true },
      permissions: ['sales:create'],
    });

    vi.mocked(prisma.sale.findUnique).mockResolvedValueOnce({
      id: 'sale-1',
      branchId: 'b-1',
      status: SaleStatus.PENDING,
    } as never);

    vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/v1/sales/sale-1/items', {
      method: 'POST',
      body: JSON.stringify({ productId: 'prod-nonexistent', quantity: 1 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 400 on invalid input (e.g. quantity < 1)', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'u-1',
      firebaseUid: 'fb-1',
      email: 'cashier@stoney.com',
      firstName: 'Cashier',
      lastName: 'User',
      phone: null,
      avatar: null,
      emailVerified: true,
      isActive: true,
      role: { id: 'r-1', name: 'Cashier', description: null },
      roleId: 'r-1',
      branchId: 'b-1',
      branch: { id: 'b-1', name: 'Main', code: 'MAIN', isActive: true },
      permissions: ['sales:create'],
    });

    vi.mocked(prisma.sale.findUnique).mockResolvedValueOnce({
      id: 'sale-1',
      branchId: 'b-1',
      status: SaleStatus.PENDING,
    } as never);

    const req = new NextRequest('http://localhost/api/v1/sales/sale-1/items', {
      method: 'POST',
      body: JSON.stringify({ productId: 'prod-1', quantity: 0 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(400);
  });

  it('successfully adds item and returns updated safe sale DTO', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'u-1',
      firebaseUid: 'fb-1',
      email: 'cashier@stoney.com',
      firstName: 'Cashier',
      lastName: 'User',
      phone: null,
      avatar: null,
      emailVerified: true,
      isActive: true,
      role: { id: 'r-1', name: 'Cashier', description: null },
      roleId: 'r-1',
      branchId: 'b-1',
      branch: { id: 'b-1', name: 'Main', code: 'MAIN', isActive: true },
      permissions: ['sales:create'],
    });

    vi.mocked(prisma.sale.findUnique)
      .mockResolvedValueOnce({
        id: 'sale-1',
        branchId: 'b-1',
        status: SaleStatus.PENDING,
      } as never)
      .mockResolvedValueOnce({
        id: 'sale-1',
        branchId: 'b-1',
        status: SaleStatus.PENDING,
        subtotal: '20.00',
        discount: '0.00',
        total: '20.00',
        customer: null,
        items: [
          {
            id: 'item-1',
            saleId: 'sale-1',
            productId: 'prod-1',
            sku: 'SKU-1',
            productName: 'Screen',
            productType: 'GOODS',
            quantity: 2,
            unitPrice: '10.00',
            discount: '0.00',
            subtotal: '20.00',
            total: '20.00',
            fulfillmentStatus: 'UNFULFILLED',
          },
        ],
        payments: [],
      } as never);

    vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
      id: 'prod-1',
      name: 'Screen',
    } as never);

    vi.mocked(addSaleItem).mockResolvedValueOnce({} as never);

    const req = new NextRequest('http://localhost/api/v1/sales/sale-1/items', {
      method: 'POST',
      body: JSON.stringify({ productId: 'prod-1', quantity: 2, discount: 0 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.sale.items).toHaveLength(1);
    expect(body.data.sale.items[0].productName).toBe('Screen');
    expect(body.data.sale.balanceDue).toBe('20.00');
    expect(addSaleItem).toHaveBeenCalledTimes(1);
  });
});
