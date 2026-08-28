import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import prisma from '@/lib/prisma';
import { storage } from '@/lib/media/storage';
import { requireAuth, requireBranchAccess, requirePermission, AuthError } from '@/lib/auth/guard';
import { MediaState } from '@/generated/prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
    });

    if (!asset || asset.state !== MediaState.READY) {
      return new NextResponse('Not Found', { status: 404 });
    }

    if (!asset.isPublic) {
      try {
        await requireAuth();

        if (asset.productId) {
          await requirePermission('products:read');
        } else if (asset.repairId) {
          await requirePermission('repairs:read');
          if (asset.branchId) {
            await requireBranchAccess(asset.branchId);
          }
        }
      } catch (error: unknown) {
        if (error instanceof AuthError) {
          return new NextResponse(error.message, { status: error.statusCode });
        }
        throw error;
      }
    }

    // Attempt to stream the file
    const stream = storage.getObjectStream(asset.path);
    
    // We need to provide the size and content-type if possible, but 
    // Content-Type is sufficient for streaming.
    const headers = new Headers();
    headers.set('Content-Type', asset.mimeType);
    headers.set('Cache-Control', 'public, max-age=3600');

    // Convert NodeJS Readable to Web ReadableStream
    // Next.js NextResponse accepts Web ReadableStream
    // In Node.js 18+, Readable.toWeb is available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webStream = Readable.toWeb(stream as any);

    return new NextResponse(webStream as unknown as BodyInit, {
      status: 200,
      headers,
    });
  } catch (error: unknown) {
    console.error('Error serving media:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
