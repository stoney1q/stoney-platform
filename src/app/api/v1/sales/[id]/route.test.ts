import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { getSale } from '@/lib/sales/actions';
import { AuthError } from '@/lib/auth/guard';
import {
  SaleStatus,
  PaymentMethod,
  ProductType,
  FulfillmentStatus,
  Prisma,
} from '@/generated/prisma/client';

vi.mock('@/lib/sales/actions', () => ({
  getSale: vi.fn(),
}));

describe('Sale Detail API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(getSale).mockRejectedValueOnce(
      new AuthError('Authentication required.', 401, 'UNAUTHORIZED')
    );

    const req = new NextRequest('http://localhost:3000/api/v1/sales/s1');
    const res = await GET(req, { params: Promise.resolve({ id: 's1' }) });

    expect(res.status).toBe(401);
  });

  it('rejects cross-branch access with 403', async () => {
    vi.mocked(getSale).mockRejectedValueOnce(
      new AuthError(
        'Access denied. You do not have permission to access records for this branch.',
        403,
        'FORBIDDEN'
      )
    );

    const req = new NextRequest('http://localhost:3000/api/v1/sales/s1');
    const res = await GET(req, { params: Promise.resolve({ id: 's1' }) });

    expect(res.status).toBe(403);
  });

  it('returns 400 when sale ID is empty', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/sales/');
    const res = await GET(req, { params: Promise.resolve({ id: '' }) });

    expect(res.status).toBe(400);
  });

  it('returns 404 when sale is not found', async () => {
    vi.mocked(getSale).mockResolvedValueOnce(null);

    const req = new NextRequest(
      'http://localhost:3000/api/v1/sales/missing-id'
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: 'missing-id' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Sale not found');
  });

  it('returns full sale details, items, payments, and sanitized fields', async () => {
    vi.mocked(getSale).mockResolvedValueOnce({
      id: 's1',
      sequence: 101,
      status: SaleStatus.PENDING,
      branchId: 'b1',
      customerId: 'c1',
      createdById: 'u1',
      discount: new Prisma.Decimal('0.00'),
      subtotal: new Prisma.Decimal('100.00'),
      total: new Prisma.Decimal('100.00'),
      quotationId: null,
      repairId: null,
      completedAt: null,
      cancelledAt: null,
      createdAt: new Date('2026-09-05T12:00:00Z'),
      updatedAt: new Date('2026-09-05T12:00:00Z'),
      customer: {
        id: 'c1',
        sequence: 1,
        firstName: 'Ama',
        lastName: 'Osei',
        email: 'ama@example.com',
        phone: '+233200000000',
        alternatePhone: null,
        address: null,
        isActive: true,
        createdById: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      items: [
        {
          id: 'item-1',
          saleId: 's1',
          productId: 'p1',
          sku: 'ITEM-SKU',
          productName: 'Replacement Battery',
          productType: ProductType.GOODS,
          quantity: 1,
          unitPrice: new Prisma.Decimal('100.00'),
          discount: new Prisma.Decimal('0.00'),
          subtotal: new Prisma.Decimal('100.00'),
          total: new Prisma.Decimal('100.00'),
          fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
        },
      ],
      payments: [
        {
          id: 'pay-1',
          saleId: 's1',
          amount: new Prisma.Decimal('40.00'),
          method: PaymentMethod.CASH,
          reference: null,
          createdById: 'u1',
          createdAt: new Date('2026-09-05T12:05:00Z'),
        },
      ],
    } as unknown as never);

    const req = new NextRequest('http://localhost:3000/api/v1/sales/s1');
    const res = await GET(req, { params: Promise.resolve({ id: 's1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.sale).toBeDefined();
    expect(body.data.sale.id).toBe('s1');
    expect(body.data.sale.status).toBe('PENDING');
    expect(body.data.sale.totalPaid).toBe('40.00');
    expect(body.data.sale.balanceDue).toBe('60.00');
    expect(body.data.sale.items).toHaveLength(1);
    expect(body.data.sale.items[0].productName).toBe('Replacement Battery');
    expect(body.data.sale.payments).toHaveLength(1);
    // createdById and updatedAt stripped from sale
    expect(body.data.sale.createdById).toBeUndefined();
    expect(body.data.sale.updatedAt).toBeUndefined();
    // createdById stripped from payments
    expect(body.data.sale.payments[0].createdById).toBeUndefined();
  });
});
