'use server';

import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { initializeTransaction } from './client';
import { headers } from 'next/headers';

export async function createPaystackCheckoutSession(portalToken: string) {
  const sale = await prisma.sale.findUnique({
    where: { portalToken },
    include: { payments: true, customer: true, branch: true },
  });

  if (!sale) {
    throw new Error('Sale not found');
  }

  if (sale.status === 'CANCELLED') {
    throw new Error('Sale is cancelled and cannot be paid.');
  }

  const amountPaid = sale.payments.reduce(
    (sum, p) => sum.add(p.amount),
    new Prisma.Decimal(0)
  );
  const remaining = sale.total.sub(amountPaid);

  if (remaining.lte(0)) {
    throw new Error('Sale is already fully paid.');
  }

  // Paystack minimum charge enforcement (e.g. 0.10 GHS = 10 pesewas)
  if (remaining.lt(0.1)) {
    throw new Error(
      'Remaining balance is too small for online payment processing. Please pay in store.'
    );
  }

  // Strictly convert to integer pesewas using Prisma.Decimal to avoid floating point math errors
  const amountPesewas = remaining
    .mul(100)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();

  const customerEmail =
    sale.customer.email || `customer-${sale.id}@example.com`;

  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const callbackUrl = `${protocol}://${host}/portal/${portalToken}/success`;

  try {
    const paystackResponse = await initializeTransaction({
      email: customerEmail,
      amount: amountPesewas,
      callback_url: callbackUrl,
      metadata: {
        saleId: sale.id,
        portalToken: sale.portalToken,
        amountPesewas, // Storing for strict validation in webhook
      },
    });

    return {
      authorizationUrl: paystackResponse.authorization_url,
      reference: paystackResponse.reference,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Paystack initialize error:', error.message);
    } else {
      console.error('Paystack initialize error:', error);
    }
    throw new Error('Failed to initialize online payment.');
  }
}
