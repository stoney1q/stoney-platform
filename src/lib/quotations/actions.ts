'use server';

import { prisma } from '@/lib/prisma';
import {
  requireAuth,
  requirePermission,
  requireBranchAccess,
} from '@/lib/auth/guard';
import {
  createQuotationSchema,
  addQuotationItemSchema,
  removeQuotationItemSchema,
  updateQuotationStatusSchema,
  convertQuotationToSaleSchema,
} from './validation';
import { Prisma, QuotationStatus, SaleStatus } from '@/generated/prisma/client';
import {
  calculateDocumentSubtotal,
  calculateLineTotal,
  calculateLineSubtotal,
} from '@/lib/pricing/math';

export async function searchQuotations(options: {
  query?: string;
  page?: number;
  status?: QuotationStatus;
}) {
  const session = await requireAuth();
  await requirePermission('quotations:read');

  const { query, page = 1, status } = options;
  const pageSize = 10;
  const skip = (page - 1) * pageSize;

  const where: Prisma.QuotationWhereInput = {
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

  const [total, quotations] = await Promise.all([
    prisma.quotation.count({ where }),
    prisma.quotation.findMany({
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
      quotations,
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: page,
    },
  };
}

export async function getQuotation(id: string) {
  await requireAuth();
  await requirePermission('quotations:read');

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        include: { product: true },
      },
      sale: true,
    },
  });

  if (!quotation) {
    return null;
  }

  await requireBranchAccess(quotation.branchId);

  return quotation;
}

function calculateQuotationTotals(
  items: { total: Prisma.Decimal }[],
  quotationDiscount: Prisma.Decimal
) {
  const subtotal = new Prisma.Decimal(
    calculateDocumentSubtotal(items).toString()
  );
  const total = new Prisma.Decimal(
    calculateLineTotal(subtotal, quotationDiscount).toString()
  );
  return {
    subtotal,
    total,
  };
}

export async function createQuotation(formData: FormData) {
  const session = await requireAuth();
  await requirePermission('quotations:create');

  const rawData = {
    customerId: formData.get('customerId') as string,
  };

  const data = createQuotationSchema.parse(rawData);
  const branchId = session.branchId;

  return prisma.quotation.create({
    data: {
      customerId: data.customerId,
      branchId,
      createdById: session.id,
      status: QuotationStatus.DRAFT,
      discount: new Prisma.Decimal(0),
      subtotal: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
    },
  });
}

export async function addQuotationItem(formData: FormData) {
  await requirePermission('quotations:create');

  const rawData = {
    quotationId: formData.get('quotationId') as string,
    productId: formData.get('productId') as string,
    quantity: Number(formData.get('quantity')),
    discount: Number(formData.get('discount') || 0),
  };

  const data = addQuotationItemSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: data.quotationId },
    });

    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new Error('Can only add items to a DRAFT quotation');
    }

    await requireBranchAccess(quotation.branchId);

    const product = await tx.product.findUniqueOrThrow({
      where: { id: data.productId },
    });

    const unitPrice = product.sellingPrice;
    const itemDiscount = new Prisma.Decimal(data.discount);

    const lineSubtotal = new Prisma.Decimal(
      calculateLineSubtotal(unitPrice.toString(), data.quantity).toString()
    );
    const lineTotal = new Prisma.Decimal(
      calculateLineTotal(
        lineSubtotal.toString(),
        itemDiscount.toString()
      ).toString()
    );

    await tx.quotationItem.create({
      data: {
        quotationId: quotation.id,
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        productType: product.type,
        quantity: data.quantity,
        unitPrice: unitPrice,
        discount: itemDiscount,
        subtotal: lineSubtotal,
        total: lineTotal,
      },
    });

    const updatedItems = await tx.quotationItem.findMany({
      where: { quotationId: quotation.id },
    });
    const { subtotal: qSub, total: qTot } = calculateQuotationTotals(
      updatedItems,
      quotation.discount
    );

    await tx.quotation.update({
      where: { id: quotation.id },
      data: {
        subtotal: qSub,
        total: qTot,
      },
    });
  });
}

export async function removeQuotationItem(formData: FormData) {
  await requirePermission('quotations:create');

  const rawData = {
    quotationId: formData.get('quotationId') as string,
    quotationItemId: formData.get('quotationItemId') as string,
  };

  const data = removeQuotationItemSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: data.quotationId },
    });

    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new Error('Can only remove items from a DRAFT quotation');
    }

    await requireBranchAccess(quotation.branchId);

    await tx.quotationItem.delete({
      where: { id: data.quotationItemId, quotationId: quotation.id },
    });

    const updatedItems = await tx.quotationItem.findMany({
      where: { quotationId: quotation.id },
    });
    const { subtotal: qSub, total: qTot } = calculateQuotationTotals(
      updatedItems,
      quotation.discount
    );

    await tx.quotation.update({
      where: { id: quotation.id },
      data: {
        subtotal: qSub,
        total: qTot,
      },
    });
  });
}

export async function updateQuotationStatus(formData: FormData) {
  await requirePermission('quotations:approve');

  const rawData = {
    quotationId: formData.get('quotationId') as string,
    status: formData.get('status') as QuotationStatus,
  };

  const data = updateQuotationStatusSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: data.quotationId },
    });

    await requireBranchAccess(quotation.branchId);

    // Some simple state machine rules
    if (quotation.status === QuotationStatus.CONVERTED) {
      throw new Error('Cannot change status of a CONVERTED quotation');
    }

    return tx.quotation.update({
      where: { id: quotation.id },
      data: { status: data.status },
    });
  });
}

export async function convertQuotationToSale(formData: FormData) {
  const session = await requireAuth();
  await requirePermission('quotations:convert');

  const rawData = {
    quotationId: formData.get('quotationId') as string,
  };

  const data = convertQuotationToSaleSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: data.quotationId },
      include: { items: true },
    });

    await requireBranchAccess(quotation.branchId);

    if (quotation.status === QuotationStatus.CONVERTED) {
      throw new Error('Quotation has already been converted to a sale');
    }

    if (quotation.status !== QuotationStatus.ACCEPTED) {
      throw new Error('Only ACCEPTED quotations can be converted to sales');
    }

    // Attempt to convert to sale. Using a nested create because quotationId is unique on Sale,
    // ensuring we can't accidentally create two sales for the same quotation.
    const sale = await tx.sale.create({
      data: {
        branchId: quotation.branchId,
        customerId: quotation.customerId,
        createdById: session.id,
        status: SaleStatus.PENDING,
        discount: quotation.discount,
        subtotal: quotation.subtotal,
        total: quotation.total,
        quotationId: quotation.id,
        repairId: quotation.repairId,
        items: {
          create: quotation.items.map((item) => ({
            productId: item.productId,
            sku: item.sku,
            productName: item.productName,
            productType: item.productType,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            subtotal: item.subtotal,
            total: item.total,
            fulfillmentStatus: item.fulfillmentStatus,
          })),
        },
      },
    });

    await tx.quotation.update({
      where: { id: quotation.id },
      data: { status: QuotationStatus.CONVERTED },
    });

    return sale;
  });
}
