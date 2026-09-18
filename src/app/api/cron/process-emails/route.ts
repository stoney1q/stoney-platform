import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendDocumentEmail } from '@/lib/documents/email';
import { storage } from '@/lib/media/storage';
import crypto from 'crypto';
import { logger } from '@/lib/observability/logger';

export const maxDuration = 60; // Max execution time for Vercel Hobby/Pro
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expectedHeader = `Bearer ${cronSecret}`;
  const authBuffer = Buffer.from(authHeader, 'utf-8');
  const expectedBuffer = Buffer.from(expectedHeader, 'utf-8');

  if (
    authBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(authBuffer, expectedBuffer)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Process up to 20 pending emails per cron tick to avoid Vercel timeouts
    const candidateLogs = await prisma.emailDeliveryLog.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          { status: 'PROCESSING', updatedAt: { lt: fiveMinutesAgo } },
        ],
      },
      take: 20,
      orderBy: { createdAt: 'asc' },
    });

    if (candidateLogs.length === 0) {
      return NextResponse.json({ message: 'No pending emails to process.' });
    }

    const results = { sent: 0, errors: 0 };

    // Process parallel requests using Promise.allSettled to speed up execution
    await Promise.allSettled(
      candidateLogs.map(async (log) => {
        // Atomically claim the record
        const { count } = await prisma.emailDeliveryLog.updateMany({
          where: {
            id: log.id,
            status: log.status, // Ensure it hasn't changed since we queried
          },
          data: { status: 'PROCESSING' },
        });

        // If count is 0, another worker claimed it or it was updated
        if (count === 0) return;

        try {
          const [typeStr] = log.idempotencyKey.split('_');
          const type = typeStr as 'SALE' | 'QUOTATION' | 'REPAIR';

          let mediaId: string | null = null;

          if (type === 'SALE') {
            const doc = await prisma.sale.findUnique({
              where: { id: log.documentId },
            });
            mediaId = doc?.documentMediaId || null;
          } else if (type === 'QUOTATION') {
            const doc = await prisma.quotation.findUnique({
              where: { id: log.documentId },
            });
            mediaId = doc?.documentMediaId || null;
          } else if (type === 'REPAIR') {
            const doc = await prisma.repair.findUnique({
              where: { id: log.documentId },
            });
            mediaId = doc?.documentMediaId || null;
          }

          if (!mediaId) {
            throw new Error('Document PDF not found or still generating');
          }

          // Generate a 7-day signed URL
          const signedUrl = await storage.generatePresignedDownloadUrl(
            mediaId,
            7 * 24 * 60 * 60 * 1000
          );

          await sendDocumentEmail(log.documentId, log.email, type, signedUrl);

          // Update database to SENT
          await prisma.emailDeliveryLog.update({
            where: { id: log.id },
            data: { status: 'SENT', error: null },
          });

          results.sent++;
        } catch (error: unknown) {
          // Log the failure in the database securely
          logger.error('Failed to process delivery log', error, {
            logId: log.id,
          });

          // Check if we should retry (transient errors within 1 hour)
          const isTransient =
            error instanceof Error &&
            (error.message.includes('PDF not found') ||
              error.message.includes('429') ||
              error.message.includes('rate limit'));
          const ageInMs = Date.now() - log.createdAt.getTime();
          const isWithinRetryWindow = ageInMs < 60 * 60 * 1000; // 1 hour

          if (isTransient && isWithinRetryWindow) {
            // Revert to PENDING to retry on next cron tick
            await prisma.emailDeliveryLog.update({
              where: { id: log.id },
              data: { status: 'PENDING' },
            });
          } else {
            // Sanitize the error message before storing it permanently
            let errorMessage = 'Email provider rejected the request';
            if (
              error instanceof Error &&
              error.message.includes('PDF not found')
            ) {
              errorMessage = 'Document PDF not found or still generating';
            }

            await prisma.emailDeliveryLog.update({
              where: { id: log.id },
              data: {
                status: 'ERROR',
                error: errorMessage,
              },
            });
            results.errors++;
          }
        }
      })
    );

    return NextResponse.json({
      success: true,
      processed: results.sent + results.errors,
      ...results,
    });
  } catch (error: unknown) {
    logger.error('Fatal cron error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
