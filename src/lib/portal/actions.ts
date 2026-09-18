'use server';

import { prisma } from '../prisma';
import { checkPortalRateLimit } from './rate-limit';
import {
  secureCompare,
  signPortalToken,
  setPortalCookie,
  verifyPortalCookie,
} from './auth';
import { headers } from 'next/headers';
import { QuotationStatus, Prisma } from '@/generated/prisma/client';

/**
 * Verifies a customer's access to a document via the portal token and their contact detail.
 * Returns a generic success response regardless of actual failure to prevent enumeration,
 * unless rate limited.
 */
export async function verifyPortalAccess(
  portalToken: string,
  contactDetail: string
) {
  // 1. IP extraction
  const headersList = await headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0] : '127.0.0.1';

  // 2. Check rate limits (both IP and Token)
  const isAllowed = checkPortalRateLimit(ip, portalToken);
  if (!isAllowed) {
    // If rate limited, return a generic message anyway to not leak that it's blocked,
    // but internally we don't issue a cookie.
    return {
      success: true,
      message: 'If the details match, you will be granted access.',
    };
  }

  // 3. Normalize contact detail input (strip non-digits for phone, lowercase for email)
  const normalizedPhoneInput = contactDetail.replace(/\D/g, '');
  const normalizedEmailInput = contactDetail.trim().toLowerCase();

  try {
    // 4. Find the document (Quotation or Repair)
    let documentId: string | null = null;
    let documentType: 'QUOTATION' | 'REPAIR' | 'SALE' | null = null;
    let customer: { email: string | null; phone: string | null } | null = null;

    const quotation = await prisma.quotation.findUnique({
      where: { portalToken },
      include: { customer: true },
    });

    if (quotation) {
      documentId = quotation.id;
      documentType = 'QUOTATION';
      customer = quotation.customer;
    } else {
      const repair = await prisma.repair.findUnique({
        where: { portalToken },
        include: { customer: true },
      });
      if (repair) {
        documentId = repair.id;
        documentType = 'REPAIR';
        customer = repair.customer;
      } else {
        const sale = await prisma.sale.findUnique({
          where: { portalToken },
          include: { customer: true },
        });
        if (sale) {
          documentId = sale.id;
          documentType = 'SALE';
          customer = sale.customer;
        }
      }
    }

    if (!documentId || !customer || !documentType) {
      return {
        success: true,
        message: 'If the details match, you will be granted access.',
      };
    }

    // 5. Securely compare contact details
    const normalizedDbPhone = customer.phone
      ? customer.phone.replace(/\D/g, '')
      : null;
    const normalizedDbEmail = customer.email
      ? customer.email.trim().toLowerCase()
      : null;

    const phoneMatches =
      normalizedPhoneInput.length > 0 &&
      secureCompare(normalizedPhoneInput, normalizedDbPhone);
    const emailMatches =
      normalizedEmailInput.length > 0 &&
      secureCompare(normalizedEmailInput, normalizedDbEmail);

    if (phoneMatches || emailMatches) {
      // Success! Sign the token and set cookie
      const jwt = await signPortalToken(documentId, documentType, portalToken);
      await setPortalCookie(jwt);

      // Audit log
      console.log(
        `[PORTAL] Customer verification attempt successful for ${documentType} ${documentId}`
      );
    } else {
      console.log(
        `[PORTAL] Customer verification attempt failed for ${documentType} ${documentId}`
      );
    }

    // Always return generic message
    return {
      success: true,
      message: 'If the details match, you will be granted access.',
    };
  } catch (error) {
    console.error('[PORTAL] Error in verifyPortalAccess:', error);
    return {
      success: true,
      message: 'If the details match, you will be granted access.',
    };
  }
}

/**
 * Fetches the document data for the portal, but only if the user is authenticated via cookie.
 */
export async function getPortalDocument(portalToken: string) {
  const payload = await verifyPortalCookie();
  if (!payload || payload.portalToken !== portalToken) {
    throw new Error('Unauthorized');
  }

  if (payload.type === 'QUOTATION') {
    const quotation = await prisma.quotation.findUnique({
      where: { id: payload.documentId as string },
      select: {
        id: true,
        documentNumber: true,
        status: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        discount: true,
        version: true,
        createdAt: true,
        branch: { select: { name: true, phone: true, email: true } },
        customer: { select: { firstName: true, lastName: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            discount: true,
            total: true,
            product: { select: { name: true, sku: true } },
          },
        },
      },
    });
    return { type: 'QUOTATION', document: quotation };
  } else if (payload.type === 'REPAIR') {
    const repair = await prisma.repair.findUnique({
      where: { id: payload.documentId as string },
      select: {
        id: true,
        documentNumber: true,
        status: true,
        issue: true,
        device: { select: { make: true, model: true } },
        createdAt: true,
        branch: { select: { name: true, phone: true, email: true } },
        customer: { select: { firstName: true, lastName: true } },
        logs: {
          select: {
            id: true,
            newState: true,
            notes: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return { type: 'REPAIR', document: repair };
  } else if (payload.type === 'SALE') {
    const sale = await prisma.sale.findUnique({
      where: { id: payload.documentId as string },
      select: {
        id: true,
        documentNumber: true,
        status: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        discount: true,
        version: true,
        createdAt: true,
        branch: { select: { name: true, phone: true, email: true } },
        customer: { select: { firstName: true, lastName: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            discount: true,
            total: true,
            product: { select: { name: true, sku: true } },
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            createdAt: true,
          },
        },
      },
    });
    return { type: 'SALE', document: sale };
  }

  throw new Error('Invalid document type');
}

/**
 * Customers can accept quotations via the portal.
 */
export async function customerAcceptQuotation(
  portalToken: string,
  expectedVersion: number
) {
  const payload = await verifyPortalCookie();
  if (
    !payload ||
    payload.portalToken !== portalToken ||
    payload.type !== 'QUOTATION'
  ) {
    throw new Error('Unauthorized');
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id: payload.documentId as string },
  });
  if (!quotation) throw new Error('Not found');

  if (
    quotation.status !== QuotationStatus.DRAFT &&
    quotation.status !== QuotationStatus.SENT
  ) {
    throw new Error('Quotation cannot be accepted in its current state');
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.quotation.update({
        where: { id: quotation.id, version: expectedVersion },
        data: {
          status: QuotationStatus.ACCEPTED,
          version: { increment: 1 },
        },
      });

      // Audit log via console output (no SystemNote in current schema)
      console.log(
        `[PORTAL] Quotation ${quotation.id} ACCEPTED by customer via portalToken ${portalToken}`
      );
    });
    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new Error('DOCUMENT_MODIFIED');
    }
    throw error;
  }
}

/**
 * Customers can reject quotations via the portal.
 */
export async function customerRejectQuotation(
  portalToken: string,
  expectedVersion: number
) {
  const payload = await verifyPortalCookie();
  if (
    !payload ||
    payload.portalToken !== portalToken ||
    payload.type !== 'QUOTATION'
  ) {
    throw new Error('Unauthorized');
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id: payload.documentId as string },
  });
  if (!quotation) throw new Error('Not found');

  if (
    quotation.status !== QuotationStatus.DRAFT &&
    quotation.status !== QuotationStatus.SENT
  ) {
    throw new Error('Quotation cannot be rejected in its current state');
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.quotation.update({
        where: { id: quotation.id, version: expectedVersion },
        data: {
          status: QuotationStatus.REJECTED,
          version: { increment: 1 },
        },
      });
      console.log(
        `[PORTAL] Quotation ${quotation.id} REJECTED by customer via portalToken ${portalToken}`
      );
    });
    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new Error('DOCUMENT_MODIFIED');
    }
    throw error;
  }
}
