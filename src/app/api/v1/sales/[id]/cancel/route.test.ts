import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { requireAuth, requireBranchAccess } from '@/lib/auth/guard';
import { prisma } from '@/lib/prisma';
import { cancelSale } from '@/lib/sales/actions';
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
  },
}));

vi.mock('@/lib/sales/actions', () => ({
  cancelSale: vi.fn(),
}));

describe('POST /api/v1/sales/[id]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const { AuthError } = await import('@/lib/auth/guard');
    vi.mocked(requireAuth).mockRejectedValueOnce(
      new AuthError('Authentication required.', 401, 'UNAUTHORIZED')
    );

    const req = new NextRequest('http://localhost/api/v1/sales/sale-1/cancel', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(401);
  });

  it('rejects users without sales:cancel or sales:delete permission with 403', async () => {
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
      permissions: ['sales:read'],
    });

    const req = new NextRequest('http://localhost/api/v1/sales/sale-1/cancel', {
      method: 'POST',
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
      permissions: ['sales:cancel'],
    });

    vi.mocked(prisma.sale.findUnique).mockResolvedValueOnce({
      id: 'sale-1',
      branchId: 'b-2',
      status: SaleStatus.PENDING,
      payments: [],
    } as never);

    const { AuthError } = await import('@/lib/auth/guard');
    vi.mocked(requireBranchAccess).mockRejectedValueOnce(
      new AuthError('Access denied.', 403, 'FORBIDDEN')
    );

    const req = new NextRequest('http://localhost/api/v1/sales/sale-1/cancel', {
      method: 'POST',
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
      permissions: ['sales:cancel'],
    });

    vi.mocked(prisma.sale.findUnique).mockResolvedValueOnce(null);

    const req = new NextRequest(
      'http://localhost/api/v1/sales/sale-missing/cancel',
      {
        method: 'POST',
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
      permissions: ['sales:cancel'],
    });

    vi.mocked(prisma.sale.findUnique).mockResolvedValueOnce({
      id: 'sale-1',
      branchId: 'b-1',
      status: SaleStatus.COMPLETED,
      payments: [],
    } as never);

    const req = new NextRequest('http://localhost/api/v1/sales/sale-1/cancel', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('pending');
  });

  it('returns 400 when sale has existing payments', async () => {
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
      permissions: ['sales:cancel'],
    });

    vi.mocked(prisma.sale.findUnique).mockResolvedValueOnce({
      id: 'sale-1',
      branchId: 'b-1',
      status: SaleStatus.PENDING,
      payments: [{ id: 'pay-1' }],
    } as never);

    const req = new NextRequest('http://localhost/api/v1/sales/sale-1/cancel', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('payments');
  });

  it('successfully cancels sale and returns cancellation data', async () => {
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
      permissions: ['sales:cancel'],
    });

    const now = new Date();
    vi.mocked(prisma.sale.findUnique).mockResolvedValueOnce({
      id: 'sale-1',
      branchId: 'b-1',
      status: SaleStatus.PENDING,
      payments: [],
    } as never);

    vi.mocked(cancelSale).mockResolvedValueOnce({
      id: 'sale-1',
      status: SaleStatus.CANCELLED,
      cancelledAt: now,
    } as never);

    const req = new NextRequest('http://localhost/api/v1/sales/sale-1/cancel', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.success).toBe(true);
    expect(body.data.saleId).toBe('sale-1');
    expect(body.data.status).toBe('CANCELLED');
    expect(cancelSale).toHaveBeenCalledTimes(1);
  });
});
