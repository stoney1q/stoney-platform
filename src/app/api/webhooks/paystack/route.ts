import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/paystack/client';
import { prisma } from '@/lib/prisma';
import { Prisma, PaymentMethod } from '@/generated/prisma/client';
import { logger } from '@/lib/observability/logger';

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const rawBody = await req.text();
    const isValid = verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    // We primarily care about successful charges
    if (event.event !== 'charge.success') {
      return NextResponse.json({ received: true });
    }

    const data = event.data;
    const metadata = data.metadata;
    const reference = data.reference;

    if (
      !metadata ||
      !metadata.saleId ||
      !metadata.portalToken ||
      metadata.amountPesewas === undefined
    ) {
      logger.error(
        'Paystack Webhook Security: Missing metadata binding',
        undefined,
        { reference }
      );
      return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 });
    }

    const amountPesewas = data.amount;
    if (amountPesewas !== metadata.amountPesewas) {
      logger.error('Paystack Webhook Security: Amount mismatch', undefined, {
        reference,
      });
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }

    const amountGhs = new Prisma.Decimal(amountPesewas).div(100);

    // Atomic transaction for settlement
    await prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existingPayment = await tx.payment.findUnique({
        where: { gatewayId: reference },
      });

      if (existingPayment) {
        logger.info(`Payment already processed.`, { reference });
        return;
      }

      // 2. Fetch target Sale
      const sale = await tx.sale.findUnique({
        where: { id: metadata.saleId },
        include: { payments: true },
      });

      if (!sale) {
        throw new Error(`Sale ${metadata.saleId} not found.`);
      }

      // 3. Cross-Sale Spoofing Verification
      if (sale.portalToken !== metadata.portalToken) {
        throw new Error(
          `CRITICAL: Spoofing attempt. PortalToken mismatch for Sale ${sale.id}`
        );
      }

      // 4. Calculate balances
      const amountPaid = sale.payments.reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0)
      );
      const newAmountPaid = amountPaid.add(amountGhs);

      // Note: If newAmountPaid > sale.total, this is implicitly an overpayment.
      // In Stoney, we record the overpayment and handle it manually via refunds/adjustments.

      // 5. Insert Payment
      await tx.payment.create({
        data: {
          saleId: sale.id,
          amount: amountGhs,
          method: PaymentMethod.PAYSTACK,
          reference: `paystack-${reference}`,
          gatewayId: reference,
          gatewayStatus: data.status, // e.g. "success"
        },
      });

      // 6. Complete Sale if fully paid
      if (newAmountPaid.gte(sale.total) && sale.status !== 'COMPLETED') {
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      }
    });

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    logger.error('Paystack Webhook Error', error);
    // Return 200 for logical errors (like spoofing) so Paystack stops retrying,
    // but log it heavily. For systemic DB issues, 500 might be appropriate, but
    // failing the webhook repeatedly might get the endpoint disabled.
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
