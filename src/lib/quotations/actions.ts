'use server';

import { prisma } from '@/lib/prisma';
import {
  requireAuth,
  requirePermission,
  requireBranchAccess,
  requireGlobalAccess,
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
  calculateLineTax,
  calculateDocumentTax,
  calculateDocumentTotal,
} from '@/lib/pricing/math';
import {
  generateDocumentNumber,
  buildSnapshotData,
} from '@/lib/documents/actions';
import { logger } from '@/lib/observability/logger';
import { after } from 'next/server';

export async function searchQuotations(options: {
  query?: string;
  page?: number;
  status?: QuotationStatus;
  branchId?: string;
}) {
  const session = await requireAuth();
  await requirePermission('quotations:read');

  const { query, page = 1, status, branchId } = options;
  const pageSize = 10;
  const skip = (page - 1) * pageSize;

  const targetBranchId = branchId || session.branchId;
  if (targetBranchId === 'all') {
    await requireGlobalAccess(session);
  } else {
    await requireBranchAccess(targetBranchId);
  }

  const where: Prisma.QuotationWhereInput = {};
  if (targetBranchId !== 'all') {
    where.branchId = targetBranchId;
  }

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
  items: {
    subtotal: Prisma.Decimal;
    discount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
  }[],
  quotationDiscount: Prisma.Decimal
) {
  const subtotal = new Prisma.Decimal(
    calculateDocumentSubtotal(items).toString()
  );
  const taxAmount = new Prisma.Decimal(calculateDocumentTax(items).toString());
  const total = new Prisma.Decimal(
    calculateDocumentTotal(items, quotationDiscount.toString()).toString()
  );
  return {
    subtotal,
    taxAmount,
    total,
  };
}

export async function createQuotation(formData: FormData) {
  const session = await requireAuth();
  await requirePermission('quotations:create');

  const rawData = {
    customerId: formData.get('customerId') as string,
    branchId: (formData.get('branchId') as string) || undefined,
  };

  const data = createQuotationSchema.parse(rawData);

  const branchId = data.branchId || session.branchId;
  await requireBranchAccess(branchId);

  return prisma.quotation.create({
    data: {
      customerId: data.customerId,
      branchId,
      createdById: session.id,
      status: QuotationStatus.DRAFT,
      discount: new Prisma.Decimal(0),
      subtotal: new Prisma.Decimal(0),
      taxAmount: new Prisma.Decimal(0),
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
    version: Number(formData.get('version')),
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
      include: { taxRate: true },
    });

    const unitPrice = product.sellingPrice;
    const itemDiscount = new Prisma.Decimal(data.discount);
    const taxRate = product.taxRate?.rate || 0;

    const lineSubtotal = new Prisma.Decimal(
      calculateLineSubtotal(unitPrice.toString(), data.quantity).toString()
    );

    const taxableAmount = lineSubtotal.sub(itemDiscount);
    const taxableBase = taxableAmount.isNegative()
      ? new Prisma.Decimal(0)
      : taxableAmount;

    const lineTax = new Prisma.Decimal(
      calculateLineTax(taxableBase.toString(), taxRate.toString()).toString()
    );
    const lineTotal = new Prisma.Decimal(
      calculateLineTotal(
        lineSubtotal.toString(),
        itemDiscount.toString(),
        lineTax.toString()
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
        taxAmount: lineTax,
        total: lineTotal,
      },
    });

    const updatedItems = await tx.quotationItem.findMany({
      where: { quotationId: quotation.id },
    });
    const {
      subtotal: qSub,
      taxAmount: qTax,
      total: qTot,
    } = calculateQuotationTotals(updatedItems, quotation.discount);

    await tx.quotation.update({
      where: { id: quotation.id, version: data.version },
      data: {
        subtotal: qSub,
        taxAmount: qTax,
        total: qTot,
        version: { increment: 1 },
      },
    });
  });
}

export async function removeQuotationItem(formData: FormData) {
  await requirePermission('quotations:create');

  const rawData = {
    quotationId: formData.get('quotationId') as string,
    quotationItemId: formData.get('quotationItemId') as string,
    version: Number(formData.get('version')),
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
    const {
      subtotal: qSub,
      taxAmount: qTax,
      total: qTot,
    } = calculateQuotationTotals(updatedItems, quotation.discount);

    await tx.quotation.update({
      where: { id: quotation.id, version: data.version },
      data: {
        subtotal: qSub,
        taxAmount: qTax,
        total: qTot,
        version: { increment: 1 },
      },
    });
  });
}

export async function updateQuotationStatus(formData: FormData) {
  await requirePermission('quotations:approve');

  const rawData = {
    quotationId: formData.get('quotationId') as string,
    status: formData.get('status') as QuotationStatus,
    version: Number(formData.get('version')),
  };

  const data = updateQuotationStatusSchema.parse(rawData);

  const wasFinalized = await prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: data.quotationId },
    });

    await requireBranchAccess(quotation.branchId);

    // Some simple state machine rules
    if (quotation.status === QuotationStatus.CONVERTED) {
      throw new Error('Cannot change status of a CONVERTED quotation');
    }

    let wasFinalized = false;

    if (
      (data.status === QuotationStatus.SENT ||
        data.status === QuotationStatus.ACCEPTED) &&
      !quotation.documentNumber
    ) {
      const documentNumber = await generateDocumentNumber(
        tx,
        quotation.branchId,
        'QUO'
      );
      const snapshotData = await buildSnapshotData(quotation.branchId, tx);

      wasFinalized = true;
      await tx.quotation.update({
        where: { id: quotation.id, version: data.version },
        data: {
          status: data.status,
          documentNumber,
          snapshotData: snapshotData as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
    } else {
      await tx.quotation.update({
        where: { id: quotation.id, version: data.version },
        data: {
          status: data.status,
          version: { increment: 1 },
        },
      });
    }

    return wasFinalized;
  });

  if (wasFinalized) {
    after(async () => {
      const { generateDocumentPdf } =
        await import('@/lib/documents/pdf-generator');
      generateDocumentPdf(data.quotationId, 'QUOTATION').catch((e) =>
        logger.error('Background PDF generation failed', e)
      );
    });
  }
}

export async function convertQuotationToSale(formData: FormData) {
  const session = await requireAuth();
  await requirePermission('quotations:convert');

  const rawData = {
    quotationId: formData.get('quotationId') as string,
    version: Number(formData.get('version')),
  };

  const data = convertQuotationToSaleSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: data.quotationId },
      include: {
        items: {
          include: {
            product: {
              include: {
                suppliers: {
                  where: { isPreferred: true },
                  orderBy: { updatedAt: 'desc' },
                },
              },
            },
          },
        },
      },
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
          create: quotation.items.map((item) => {
            const unitCost =
              item.product.suppliers[0]?.unitCost || new Prisma.Decimal(0);

            return {
              productId: item.productId,
              sku: item.sku,
              productName: item.productName,
              productType: item.productType,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost: unitCost,
              discount: item.discount,
              subtotal: item.subtotal,
              taxAmount: item.taxAmount,
              total: item.total,
              fulfillmentStatus: item.fulfillmentStatus,
            };
          }),
        },
      },
    });

    await tx.quotation.update({
      where: { id: quotation.id, version: data.version },
      data: {
        status: QuotationStatus.CONVERTED,
        version: { increment: 1 },
      },
    });

    return sale;
  });
}
