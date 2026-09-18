import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPaystackCheckoutSession } from './actions';
import { prisma } from '@/lib/prisma';
import { initializeTransaction } from './client';
import { Prisma } from '@/generated/prisma/client';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    sale: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn((key) => {
      if (key === 'host') return 'localhost:3000';
      return null;
    }),
  })),
}));

vi.mock('./client', () => ({
  initializeTransaction: vi.fn(),
}));

describe('createPaystackCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw if sale is not found', async () => {
    vi.mocked(prisma.sale.findUnique).mockResolvedValue(null);
    await expect(
      createPaystackCheckoutSession('invalid-token')
    ).rejects.toThrow('Sale not found');
  });

  it('should initialize transaction with correctly converted pesewas and securely bound metadata', async () => {
    // 100.25 GHS -> 10025 pesewas
    // Total is 200, paid is 99.75. Remaining is 100.25
    vi.mocked(prisma.sale.findUnique).mockResolvedValue({
      id: 'sale-1',
      portalToken: 'token-1',
      total: new Prisma.Decimal(200),
      status: 'FINALIZED',
      customer: { email: 'test@example.com' },
      payments: [{ amount: new Prisma.Decimal(99.75) }],
    } as unknown as Awaited<ReturnType<typeof prisma.sale.findUnique>>);

    vi.mocked(initializeTransaction).mockResolvedValue({
      authorization_url: 'https://paystack.com/auth',
      access_code: 'abc',
      reference: 'ref-123',
    });

    const result = await createPaystackCheckoutSession('token-1');

    expect(result.authorizationUrl).toBe('https://paystack.com/auth');

    expect(initializeTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        amount: 10025, // Strictly converted to integer pesewas
        metadata: {
          saleId: 'sale-1',
          portalToken: 'token-1',
          amountPesewas: 10025, // Bound to metadata to prevent mid-flight tampering
        },
      })
    );
  });

  it('should throw if remaining balance is less than 0.10 GHS (minimum Paystack charge)', async () => {
    vi.mocked(prisma.sale.findUnique).mockResolvedValue({
      id: 'sale-1',
      portalToken: 'token-1',
      total: new Prisma.Decimal(100),
      status: 'FINALIZED',
      customer: { email: 'test@example.com' },
      payments: [
        { amount: new Prisma.Decimal(99.95) }, // Remaining is 0.05
      ],
    } as unknown as Awaited<ReturnType<typeof prisma.sale.findUnique>>);

    await expect(createPaystackCheckoutSession('token-1')).rejects.toThrow(
      'Remaining balance is too small for online payment processing. Please pay in store.'
    );
  });
});
