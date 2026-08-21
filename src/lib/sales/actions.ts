'use server';

import { prisma } from '@/lib/prisma';
import {
  requireAuth,
  requirePermission,
  requireBranchAccess,
} from '@/lib/auth/guard';
import {
  createSaleSchema,
  addSaleItemSchema,
  removeSaleItemSchema,
  applyPaymentSchema,
  cancelSaleSchema,
} from './validation';
import {
  Prisma,
  SaleStatus,
  MovementType,
  PaymentMethod,
} from '@/generated/prisma/client';

export async function searchSales(options: {
  query?: string;
  page?: number;
  status?: SaleStatus;
}) {
  const session = await requireAuth();
  await requirePermission('sales:read');

  const { query, page = 1, status } = options;
  const pageSize = 10;
  const skip = (page - 1) * pageSize;

  const where: Prisma.SaleWhereInput = {
    branchId: session.branchId,
  };

  if (status) {
    where.status = status;
  }

  if (query) {
    where.OR = [
      { id: { contains: query, mode: 'insensitive' } },
      { customer: { firstName: { contains: query, mode: 'insensitive' } } },
      { customer: { lastName: { contains: query, mode: 'insensitive' } } },
    ];
  }

  const [total, sales] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        _count: { select: { items: true } },
      },
    }),
  ]);

  return {
    success: true,
    data: {
      sales,
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: page,
    },
  };
}

export async function getSale(id: string) {
  await requireAuth();
  await requirePermission('sales:read');

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        include: { product: true },
      },
      payments: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!sale) {
    return null;
  }

  await requireBranchAccess(sale.branchId);

  return sale;
}

function calculateSaleTotals(
  items: {
    subtotal: Prisma.Decimal;
    discount: Prisma.Decimal;
    total: Prisma.Decimal;
  }[],
  saleDiscount: Prisma.Decimal
) {
  const subtotal = items.reduce(
    (sum, item) => sum.add(item.total),
    new Prisma.Decimal(0)
  );
  const total = subtotal.sub(saleDiscount);
  return {
    subtotal,
    total: total.isNegative() ? new Prisma.Decimal(0) : total,
  };
}

export async function createSale(formData: FormData) {
  const session = await requireAuth();
  await requirePermission('sales:create');

  const rawData = {
    customerId: formData.get('customerId') as string,
  };

  const data = createSaleSchema.parse(rawData);

  // The branchId is securely derived from the authenticated PostgreSQL User context.
  const branchId = session.branchId;

  return prisma.sale.create({
    data: {
      customerId: data.customerId,
      branchId,
      createdById: session.id,
      status: SaleStatus.PENDING,
      discount: new Prisma.Decimal(0),
      subtotal: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
    },
  });
}

export async function addSaleItem(formData: FormData) {
  await requirePermission('sales:create');

  const rawData = {
    saleId: formData.get('saleId') as string,
    productId: formData.get('productId') as string,
    quantity: Number(formData.get('quantity')),
    discount: Number(formData.get('discount') || 0),
  };

  const data = addSaleItemSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    // 1. Verify Sale
    const sale = await tx.sale.findUniqueOrThrow({
      where: { id: data.saleId },
      include: { items: true },
    });

    if (sale.status !== SaleStatus.PENDING) {
      throw new Error('Can only add items to a pending sale');
    }

    await requireBranchAccess(sale.branchId);

    // 2. Fetch authoritative product price
    const product = await tx.product.findUniqueOrThrow({
      where: { id: data.productId },
    });

    // 3. Exact decimal calculations
    const unitPrice = product.sellingPrice;
    const quantity = new Prisma.Decimal(data.quantity);
    const itemDiscount = new Prisma.Decimal(data.discount);

    const lineSubtotal = unitPrice.mul(quantity);
    let lineTotal = lineSubtotal.sub(itemDiscount);

    if (lineTotal.isNegative()) {
      lineTotal = new Prisma.Decimal(0);
    }

    // 4. Create immutable SaleItem snapshot
    await tx.saleItem.create({
      data: {
        saleId: sale.id,
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        quantity: data.quantity,
        unitPrice: unitPrice,
        discount: itemDiscount,
        subtotal: lineSubtotal,
        total: lineTotal,
      },
    });

    // 5. Recalculate Sale Totals
    const updatedItems = await tx.saleItem.findMany({
      where: { saleId: sale.id },
    });
    const { subtotal: saleSubtotal, total: saleTotal } = calculateSaleTotals(
      updatedItems,
      sale.discount
    );

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        subtotal: saleSubtotal,
        total: saleTotal,
      },
    });
  });
}

export async function removeSaleItem(formData: FormData) {
  await requirePermission('sales:create');

  const rawData = {
    saleId: formData.get('saleId') as string,
    saleItemId: formData.get('saleItemId') as string,
  };

  const data = removeSaleItemSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUniqueOrThrow({
      where: { id: data.saleId },
      include: { items: true },
    });

    if (sale.status !== SaleStatus.PENDING) {
      throw new Error('Can only remove items from a pending sale');
    }

    await requireBranchAccess(sale.branchId);

    await tx.saleItem.delete({
      where: { id: data.saleItemId, saleId: sale.id },
    });

    // Recalculate Sale Totals
    const updatedItems = await tx.saleItem.findMany({
      where: { saleId: sale.id },
    });
    const { subtotal: saleSubtotal, total: saleTotal } = calculateSaleTotals(
      updatedItems,
      sale.discount
    );

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        subtotal: saleSubtotal,
        total: saleTotal,
      },
    });
  });
}

export async function applyPayment(formData: FormData) {
  const session = await requirePermission('payments:create');

  const rawData = {
    saleId: formData.get('saleId') as string,
    amount: Number(formData.get('amount')),
    method: formData.get('method') as PaymentMethod,
    reference: formData.get('reference') as string | undefined,
  };

  const data = applyPaymentSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUniqueOrThrow({
      where: { id: data.saleId },
      include: { items: true, payments: true },
    });

    if (sale.status !== SaleStatus.PENDING) {
      throw new Error('Can only apply payments to a pending sale');
    }

    await requireBranchAccess(sale.branchId);

    const paymentAmount = new Prisma.Decimal(data.amount);
    const existingPaymentsTotal = sale.payments.reduce(
      (sum, p) => sum.add(p.amount),
      new Prisma.Decimal(0)
    );
    const newTotalPaid = existingPaymentsTotal.add(paymentAmount);

    if (newTotalPaid.greaterThan(sale.total)) {
      throw new Error('Overpayment is not allowed');
    }

    const isFinalPayment = newTotalPaid.equals(sale.total);

    // If this payment fully pays the sale, perform the atomic inventory consumption
    if (isFinalPayment) {
      for (const item of sale.items) {
        // Raw SQL conditional inventory update
        const result = await tx.$executeRaw`
          UPDATE "BranchStock"
          SET "onHand" = "onHand" - ${item.quantity},
              "updatedAt" = NOW()
          WHERE "branchId" = ${sale.branchId}
            AND "productId" = ${item.productId}
            AND ("onHand" - "reserved") >= ${item.quantity}
        `;

        if (result === 0) {
          throw new Error(`Insufficient stock for product ${item.productName}`);
        }

        // Create StockMovement(SALE)
        await tx.stockMovement.create({
          data: {
            branchId: sale.branchId,
            productId: item.productId,
            quantity: -item.quantity,
            type: MovementType.SALE,
            referenceId: sale.id,
            reason: 'Sale completed',
            userId: session.id,
          },
        });
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: SaleStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    }

    // Always record the payment if we got this far
    await tx.payment.create({
      data: {
        saleId: sale.id,
        amount: paymentAmount,
        method: data.method,
        reference: data.reference,
        createdById: session.id,
      },
    });
  });
}

export async function cancelSale(formData: FormData) {
  await requirePermission('sales:delete');

  const data = cancelSaleSchema.parse({
    saleId: formData.get('saleId'),
  });

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUniqueOrThrow({
      where: { id: data.saleId },
      include: { payments: true },
    });

    if (sale.status !== SaleStatus.PENDING) {
      throw new Error('Can only cancel a pending sale');
    }

    if (sale.payments.length > 0) {
      throw new Error('Cannot cancel a sale with existing payments');
    }

    await requireBranchAccess(sale.branchId);

    return tx.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
  });
}
