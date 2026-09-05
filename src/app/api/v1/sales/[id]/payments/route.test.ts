import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import {
  requireAuth,
  requirePermission,
  requireBranchAccess,
} from '@/lib/auth/guard';
import { prisma } from '@/lib/prisma';
import { applyPayment } from '@/lib/sales/actions';
import { PaymentMethod, SaleStatus } from '@/generated/prisma/client';

vi.mock('@/lib/auth/guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guard')>();
  return {
    ...actual,
    requireAuth: vi.fn(),
    requirePermission: vi.fn(),
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
  applyPayment: vi.fn(),
}));

describe('POST /api/v1/sales/[id]/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const { AuthError } = await import('@/lib/auth/guard');
    vi.mocked(requireAuth).mockRejectedValueOnce(
      new AuthError('Authentication required.', 401, 'UNAUTHORIZED')
    );

    const req = new NextRequest(
      'http://localhost/api/v1/sales/sale-1/payments',
      {
        method: 'POST',
        body: JSON.stringify({ amount: 50, method: 'CASH' }),
      }
    );
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(401);
  });

  it('rejects users without payments:create permission with 403', async () => {
    const { AuthError } = await import('@/lib/auth/guard');
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'u-1',
      firebaseUid: 'fb-1',
      email: 'user@stoney.com',
      firstName: 'Test',
      lastName: 'User',
      phone: null,
      avatar: null,
      emailVerified: true,
      isActive: true,
      role: { id: 'r-1', name: 'Tech', description: null },
      roleId: 'r-1',
      branchId: 'b-1',
      branch: { id: 'b-1', name: 'Main', code: 'MAIN', isActive: true },
      permissions: ['repairs:read'],
    });
    vi.mocked(requirePermission).mockRejectedValueOnce(
      new AuthError('Access denied.', 403, 'FORBIDDEN')
    );

    const req = new NextRequest(
      'http://localhost/api/v1/sales/sale-1/payments',
      {
        method: 'POST',
        body: JSON.stringify({ amount: 50, method: 'CASH' }),
      }
    );
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
      permissions: ['payments:create'],
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

    const req = new NextRequest(
      'http://localhost/api/v1/sales/sale-1/payments',
      {
        method: 'POST',
        body: JSON.stringify({ amount: 50, method: 'CASH' }),
      }
    );
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
      permissions: ['payments:create'],
    });

    vi.mocked(prisma.sale.findUnique).mockResolvedValueOnce(null);

    const req = new NextRequest(
      'http://localhost/api/v1/sales/sale-missing/payments',
      {
        method: 'POST',
        body: JSON.stringify({ amount: 50, method: 'CASH' }),
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
      permissions: ['payments:create'],
    });

    vi.mocked(prisma.sale.findUnique).mockResolvedValueOnce({
      id: 'sale-1',
      branchId: 'b-1',
      status: SaleStatus.COMPLETED,
    } as never);

    const req = new NextRequest(
      'http://localhost/api/v1/sales/sale-1/payments',
      {
        method: 'POST',
        body: JSON.stringify({ amount: 50, method: 'CASH' }),
      }
    );
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('pending');
  });

  it('returns 400 on invalid input body (e.g. non-positive amount or invalid method)', async () => {
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
      permissions: ['payments:create'],
    });

    vi.mocked(prisma.sale.findUnique).mockResolvedValueOnce({
      id: 'sale-1',
      branchId: 'b-1',
      status: SaleStatus.PENDING,
    } as never);

    const req = new NextRequest(
      'http://localhost/api/v1/sales/sale-1/payments',
      {
        method: 'POST',
        body: JSON.stringify({ amount: -10, method: 'INVALID' }),
      }
    );
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when applyPayment throws an overpayment domain error', async () => {
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
      permissions: ['payments:create'],
    });

    vi.mocked(prisma.sale.findUnique).mockResolvedValueOnce({
      id: 'sale-1',
      branchId: 'b-1',
      status: SaleStatus.PENDING,
    } as never);

    vi.mocked(applyPayment).mockRejectedValueOnce(
      new Error('Overpayment is not allowed')
    );

    const req = new NextRequest(
      'http://localhost/api/v1/sales/sale-1/payments',
      {
        method: 'POST',
        body: JSON.stringify({ amount: 9999, method: PaymentMethod.CASH }),
      }
    );
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Overpayment is not allowed');
  });

  it('successfully applies payment and returns updated sale with SafeSaleDTO', async () => {
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
      permissions: ['payments:create'],
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
        status: SaleStatus.COMPLETED,
        subtotal: '100.00',
        discount: '0.00',
        total: '100.00',
        customer: null,
        items: [],
        payments: [
          {
            id: 'pay-1',
            saleId: 'sale-1',
            amount: '100.00',
            method: 'CARD',
            reference: 'REF123',
            createdAt: new Date(),
            createdById: 'u-1',
          },
        ],
      } as never);

    vi.mocked(applyPayment).mockResolvedValueOnce({} as never);

    const req = new NextRequest(
      'http://localhost/api/v1/sales/sale-1/payments',
      {
        method: 'POST',
        body: JSON.stringify({
          amount: 100,
          method: PaymentMethod.CARD,
          reference: 'REF123',
        }),
      }
    );
    const res = await POST(req, { params: Promise.resolve({ id: 'sale-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.sale.status).toBe('COMPLETED');
    expect(body.data.sale.totalPaid).toBe('100.00');
    expect(body.data.sale.balanceDue).toBe('0.00');
    expect(body.data.sale.payments[0].createdById).toBeUndefined();
    expect(applyPayment).toHaveBeenCalledTimes(1);
  });
});
