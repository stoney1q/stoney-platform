import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { prisma } from '@/lib/prisma';
import * as paystackClient from '@/lib/paystack/client';
import { Prisma } from '@/generated/prisma/client';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    payment: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    sale: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/paystack/client', () => ({
  verifyWebhookSignature: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

describe('Paystack Webhook POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if missing signature', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('should return 401 if signature is invalid', async () => {
    vi.spyOn(paystackClient, 'verifyWebhookSignature').mockReturnValue(false);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'x-paystack-signature': 'invalid-sig' },
      body: JSON.stringify({}),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('should return 400 if metadata is missing', async () => {
    vi.spyOn(paystackClient, 'verifyWebhookSignature').mockReturnValue(true);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'x-paystack-signature': 'valid-sig' },
      body: JSON.stringify({
        event: 'charge.success',
        data: {
          reference: 'ref-123',
          amount: 10000,
        },
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid metadata');
  });

  it('should return 400 if amount does not match metadata', async () => {
    vi.spyOn(paystackClient, 'verifyWebhookSignature').mockReturnValue(true);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'x-paystack-signature': 'valid-sig' },
      body: JSON.stringify({
        event: 'charge.success',
        data: {
          reference: 'ref-123',
          amount: 10000, // Attacker manipulated payload amount
          metadata: {
            saleId: 'sale-1',
            portalToken: 'token-1',
            amountPesewas: 20000, // Original expected amount
          },
        },
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Amount mismatch');
  });

  it('should process successfully with valid metadata and matching amount', async () => {
    vi.spyOn(paystackClient, 'verifyWebhookSignature').mockReturnValue(true);

    // Mock the transaction to execute the callback
    vi.mocked(prisma.$transaction).mockImplementation(
      async (cb: Parameters<typeof prisma.$transaction>[0]) => {
        return cb(prisma);
      }
    );

    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.sale.findUnique).mockResolvedValue({
      id: 'sale-1',
      portalToken: 'token-1',
      total: new Prisma.Decimal(100),
      status: 'FINALIZED',
      payments: [],
    } as unknown as Awaited<ReturnType<typeof prisma.sale.findUnique>>);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'x-paystack-signature': 'valid-sig' },
      body: JSON.stringify({
        event: 'charge.success',
        data: {
          reference: 'ref-123',
          amount: 10000,
          status: 'success',
          metadata: {
            saleId: 'sale-1',
            portalToken: 'token-1',
            amountPesewas: 10000,
          },
        },
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: new Prisma.Decimal(100),
          gatewayId: 'ref-123',
        }),
      })
    );
  });

  it('should throw an error and return 500 on cross-sale spoofing (portalToken mismatch)', async () => {
    vi.spyOn(paystackClient, 'verifyWebhookSignature').mockReturnValue(true);

    vi.mocked(prisma.$transaction).mockImplementation(
      async (cb: Parameters<typeof prisma.$transaction>[0]) => {
        return cb(prisma);
      }
    );

    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.sale.findUnique).mockResolvedValue({
      id: 'sale-1',
      portalToken: 'different-token', // Mismatch!
      total: new Prisma.Decimal(100),
      payments: [],
    } as unknown as Awaited<ReturnType<typeof prisma.sale.findUnique>>);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'x-paystack-signature': 'valid-sig' },
      body: JSON.stringify({
        event: 'charge.success',
        data: {
          reference: 'ref-123',
          amount: 10000,
          status: 'success',
          metadata: {
            saleId: 'sale-1',
            portalToken: 'token-1', // Attacker provides token-1
            amountPesewas: 10000,
          },
        },
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(500); // Because it throws an Error inside the transaction
  });
});
