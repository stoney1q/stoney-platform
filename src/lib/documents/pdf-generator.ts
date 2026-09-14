import 'server-only';
import { prisma } from '@/lib/prisma';
import { generateAndStorePdf } from './pdf-renderer';
import { Prisma } from '@/generated/prisma/client';
import { DocumentSnapshotData } from '@/components/documents/ReceiptTemplate';

export async function generateDocumentPdf(
  documentId: string,
  type: 'SALE' | 'QUOTATION' | 'REPAIR'
) {
  let dbDoc: {
    documentNumber: string | null;
    completedAt?: Date | null;
    createdAt: Date;
    snapshotData: Prisma.JsonValue | null;
    subtotal?: Prisma.Decimal | null;
    taxAmount?: Prisma.Decimal | null;
    discount?: Prisma.Decimal | null;
    total?: Prisma.Decimal | null;
  } | null = null;

  let items: {
    productName: string;
    quantity: number;
    unitPrice?: Prisma.Decimal;
    total: Prisma.Decimal | number;
  }[] = [];

  let customer: { firstName: string; lastName: string } | null = null;

  if (type === 'SALE') {
    const sale = await prisma.sale.findUnique({
      where: { id: documentId },
      include: { items: true, customer: true, payments: true },
    });
    if (!sale) return;
    dbDoc = sale;
    customer = sale.customer;
    items = sale.items;
  } else if (type === 'QUOTATION') {
    const quotation = await prisma.quotation.findUnique({
      where: { id: documentId },
      include: { items: true, customer: true },
    });
    if (!quotation) return;
    dbDoc = quotation;
    customer = quotation.customer;
    items = quotation.items;
  } else if (type === 'REPAIR') {
    const repair = await prisma.repair.findUnique({
      where: { id: documentId },
      include: { parts: { include: { product: true } }, customer: true },
    });
    if (!repair) return;
    dbDoc = repair;
    customer = repair.customer;
    items = repair.parts.map((p) => ({
      productName: p.product.name,
      quantity: p.consumedQuantity,
      unitPrice: p.product.sellingPrice,
      total: p.product.sellingPrice.mul(p.consumedQuantity),
    }));
  }

  if (!dbDoc || !dbDoc.snapshotData) return;

  const path = await generateAndStorePdf(documentId, type, {
    type,
    documentNumber: dbDoc.documentNumber,
    date: dbDoc.completedAt || dbDoc.createdAt,
    snapshotData: dbDoc.snapshotData as unknown as DocumentSnapshotData,
    customer,
    items,
    totals: {
      subtotal: dbDoc.subtotal || new Prisma.Decimal(0),
      taxAmount: dbDoc.taxAmount || new Prisma.Decimal(0),
      discount: dbDoc.discount || new Prisma.Decimal(0),
      total: dbDoc.total || new Prisma.Decimal(0),
    },
  });

  // Update DB with the media ID
  if (type === 'SALE') {
    await prisma.sale.update({
      where: { id: documentId },
      data: { documentMediaId: path },
    });
  } else if (type === 'QUOTATION') {
    await prisma.quotation.update({
      where: { id: documentId },
      data: { documentMediaId: path },
    });
  } else if (type === 'REPAIR') {
    await prisma.repair.update({
      where: { id: documentId },
      data: { documentMediaId: path },
    });
  }
}
