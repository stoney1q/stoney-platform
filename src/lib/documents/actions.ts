'use server';

import { prisma } from '@/lib/prisma';
import {
  requireAuth,
  requireBranchAccess,
  requirePermission,
} from '@/lib/auth/guard';
import { emailDocumentSchema, crossBranchLookupSchema } from './validation';
import { storage } from '@/lib/media/storage';
import { after } from 'next/server';
import { Prisma } from '@/generated/prisma/client';

export async function buildSnapshotData(
  branchId: string,
  tx: Prisma.TransactionClient = prisma
) {
  const branch = await tx.branch.findUnique({
    where: { id: branchId },
    select: {
      name: true,
      address: true,
      phone: true,
      email: true,
      code: true,
    },
  });

  if (!branch) throw new Error('Branch not found');

  const settings = (await tx.storeSettings.findUnique({
    where: { id: 'global' },
  })) || {
    currencyCode: 'USD',
    currencySymbol: '$',
    taxRegistration: null,
    receiptFooter: null,
  };

  return {
    branch,
    settings,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateDocumentNumber(
  tx: Prisma.TransactionClient,
  branchId: string,
  prefix: string
): Promise<string> {
  const updatedSeq = await tx.branchSequence.upsert({
    where: {
      branchId_prefix: {
        branchId,
        prefix,
      },
    },
    update: {
      currentValue: {
        increment: 1,
      },
    },
    create: {
      branchId,
      prefix,
      currentValue: 1,
    },
  });

  // Format as Prefix-BranchCode-Number e.g., INV-BR1-00042
  const branch = await tx.branch.findUnique({
    where: { id: branchId },
    select: { code: true },
  });

  const paddedValue = updatedSeq.currentValue.toString().padStart(5, '0');
  return `${prefix}-${branch?.code || 'XX'}-${paddedValue}`;
}

export async function enqueueDocumentEmail(
  documentId: string,
  email: string,
  documentType: 'SALE' | 'QUOTATION' | 'REPAIR'
) {
  // Validate input
  emailDocumentSchema.parse({ documentId, email, documentType });

  // Verify authorization
  let branchId: string | null = null;
  if (documentType === 'SALE') {
    const doc = await prisma.sale.findUnique({ where: { id: documentId } });
    branchId = doc?.branchId || null;
  } else if (documentType === 'QUOTATION') {
    const doc = await prisma.quotation.findUnique({
      where: { id: documentId },
    });
    branchId = doc?.branchId || null;
  } else if (documentType === 'REPAIR') {
    const doc = await prisma.repair.findUnique({ where: { id: documentId } });
    branchId = doc?.branchId || null;
  }

  if (!branchId) throw new Error('Document not found');
  await requireBranchAccess(branchId);

  // Generate an idempotency key (document + email)
  const idempotencyKey = `${documentType}_${documentId}_${email}`;

  try {
    // Try to create first to ensure no TOCTOU if it's the very first request
    await prisma.emailDeliveryLog.create({
      data: {
        documentId,
        email,
        idempotencyKey,
        status: 'PENDING',
      },
    });
  } catch (error: unknown) {
    // If P2002 (Unique constraint failed), the record exists
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // Use updateMany so we can safely condition the update on status != SENT
      await prisma.emailDeliveryLog.updateMany({
        where: {
          idempotencyKey,
          status: { not: 'SENT' },
        },
        data: {
          status: 'PENDING',
          error: null,
        },
      });
    } else {
      throw error;
    }
  }

  // Background dispatch would go here (e.g. using Inngest or Upstash)
  // For now, simulate background by doing a naive fetch or setImmediate logic in a real app,
  // but since we aren't implementing the actual Resend queue here, we just leave it PENDING
  // and maybe manually trigger it or have a simulated background worker if needed.
}

export async function crossBranchDocumentLookup(formData: FormData) {
  const data = crossBranchLookupSchema.parse({
    documentNumber: formData.get('documentNumber'),
    verificationFactor: formData.get('verificationFactor'),
  });

  // Lookup the document across the entire system without requireBranchAccess
  const session = await requirePermission('sales:read'); // But still require general sales access

  // Audit Logging: Log the cross-branch access attempt for security auditing
  console.info(
    `[AUDIT] User ${session.id} is attempting cross-branch lookup for document ${data.documentNumber}`
  );

  const sale = await prisma.sale.findUnique({
    where: { documentNumber: data.documentNumber },
    include: {
      customer: true,
    },
  });

  if (!sale) throw new Error('Document not found');

  // Verify factor
  const factor = data.verificationFactor.toLowerCase().trim();
  const customerEmail = sale.customer.email?.toLowerCase().trim() || '';
  const customerPhone = sale.customer.phone?.trim() || '';

  if (factor !== customerEmail && factor !== customerPhone) {
    throw new Error('Verification failed. Invalid email or phone.');
  }

  return sale;
}

export async function getDocumentSignedUrl(
  documentId: string,
  type: 'SALE' | 'QUOTATION' | 'REPAIR'
): Promise<string> {
  let mediaId: string | null = null;
  let branchId: string | null = null;

  if (type === 'SALE') {
    const doc = await prisma.sale.findUnique({ where: { id: documentId } });
    mediaId = doc?.documentMediaId || null;
    branchId = doc?.branchId || null;
  } else if (type === 'QUOTATION') {
    const doc = await prisma.quotation.findUnique({
      where: { id: documentId },
    });
    mediaId = doc?.documentMediaId || null;
    branchId = doc?.branchId || null;
  } else if (type === 'REPAIR') {
    const doc = await prisma.repair.findUnique({ where: { id: documentId } });
    mediaId = doc?.documentMediaId || null;
    branchId = doc?.branchId || null;
  }

  if (!branchId) throw new Error('Document not found');
  await requireBranchAccess(branchId);

  if (!mediaId) throw new Error('Document PDF not found or still generating');

  // Generate 5 minute signed URL
  return await storage.generatePresignedDownloadUrl(mediaId, 5 * 60 * 1000);
}

export async function regenerateDocumentPdfAction(formData: FormData) {
  const documentId = formData.get('documentId')?.toString();
  const type = formData.get('type')?.toString() as
    'SALE' | 'QUOTATION' | 'REPAIR';

  if (!documentId || !type) throw new Error('Invalid input');
  if (!['SALE', 'QUOTATION', 'REPAIR'].includes(type))
    throw new Error('Invalid document type');

  // Verify authorization
  let branchId: string | null = null;
  if (type === 'SALE') {
    const doc = await prisma.sale.findUnique({ where: { id: documentId } });
    branchId = doc?.branchId || null;
  } else if (type === 'QUOTATION') {
    const doc = await prisma.quotation.findUnique({
      where: { id: documentId },
    });
    branchId = doc?.branchId || null;
  } else if (type === 'REPAIR') {
    const doc = await prisma.repair.findUnique({ where: { id: documentId } });
    branchId = doc?.branchId || null;
  }

  if (!branchId) throw new Error('Document not found');
  await requireBranchAccess(branchId);

  // Trigger PDF generation in the background
  after(async () => {
    const { generateDocumentPdf } = await import('./pdf-generator');
    generateDocumentPdf(documentId, type).catch(console.error);
  });
}

export async function getDocumentDeliveryLogs(documentId: string) {
  const session = await requireAuth();

  // Resolve branch ID by checking all document types
  const [sale, quotation, repair] = await Promise.all([
    prisma.sale.findUnique({
      where: { id: documentId },
      select: { branchId: true },
    }),
    prisma.quotation.findUnique({
      where: { id: documentId },
      select: { branchId: true },
    }),
    prisma.repair.findUnique({
      where: { id: documentId },
      select: { branchId: true },
    }),
  ]);

  const branchId = sale?.branchId || quotation?.branchId || repair?.branchId;

  if (branchId) {
    await requireBranchAccess(branchId);
  } else {
    // If document is not found, fallback to global admin check or deny
    if (
      session.role.name !== 'Super Admin' &&
      !session.permissions.includes('admin:global')
    ) {
      throw new Error('Access denied');
    }
  }

  return prisma.emailDeliveryLog.findMany({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function retryDocumentEmail(logId: string) {
  const session = await requireAuth();

  const log = await prisma.emailDeliveryLog.findUnique({
    where: { id: logId },
  });

  if (!log) throw new Error('Delivery log not found');

  // Basic auth check using the document's branch
  // Extract type from idempotencyKey
  const [type] = log.idempotencyKey.split('_');

  let branchId: string | null = null;
  if (type === 'SALE') {
    const doc = await prisma.sale.findUnique({ where: { id: log.documentId } });
    branchId = doc?.branchId || null;
  } else if (type === 'QUOTATION') {
    const doc = await prisma.quotation.findUnique({
      where: { id: log.documentId },
    });
    branchId = doc?.branchId || null;
  } else if (type === 'REPAIR') {
    const doc = await prisma.repair.findUnique({
      where: { id: log.documentId },
    });
    branchId = doc?.branchId || null;
  }

  if (branchId) {
    await requireBranchAccess(branchId);
  } else {
    // If we can't resolve branch, require global as fallback to be safe
    if (
      session.role.name !== 'Super Admin' &&
      !session.permissions.includes('admin:global')
    ) {
      throw new Error('Access denied');
    }
  }

  await prisma.emailDeliveryLog.update({
    where: { id: logId },
    data: {
      status: 'PENDING',
      error: null,
    },
  });
}
