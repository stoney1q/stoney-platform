'use server';

import { requireAuth, requireBranchAccess, requirePermission } from '../auth/guard';
import prisma from '../prisma';
import { storage } from './storage';
import { MediaState } from '../../generated/prisma/client';

export interface GenerateUploadUrlParams {
  entityType: 'product' | 'repair';
  entityId: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
}

export interface GenerateUploadUrlResponse {
  uploadUrl: string;
  assetId: string;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function generateUploadUrl(
  params: GenerateUploadUrlParams
): Promise<GenerateUploadUrlResponse> {
  const user = await requireAuth();

  if (params.sizeBytes > MAX_SIZE_BYTES) {
    throw new Error('File size exceeds the 5MB limit.');
  }

  if (!ALLOWED_MIME_TYPES.includes(params.mimeType)) {
    throw new Error('Invalid file type.');
  }

  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error('Storage bucket not configured.');
  }

  let path = '';
  let branchId: string | null = null;
  let isPublic = false;

  if (params.entityType === 'product') {
    await requirePermission('products:write');
    const product = await prisma.product.findUnique({
      where: { id: params.entityId },
    });
    if (!product) {
      throw new Error('Product not found.');
    }
    isPublic = true;
    // We don't have the cuid yet, so we generate the record first
  } else if (params.entityType === 'repair') {
    const repair = await prisma.repair.findUnique({
      where: { id: params.entityId },
    });
    if (!repair) {
      throw new Error('Repair not found.');
    }
    await requireBranchAccess(repair.branchId);
    await requirePermission('repairs:write');
    branchId = repair.branchId;
    isPublic = false;
  } else {
    throw new Error('Invalid entity type.');
  }

  // Generate the PENDING record to get the CUID
  const pendingAsset = await prisma.mediaAsset.create({
    data: {
      state: MediaState.PENDING,
      bucket,
      path: 'placeholder', // Will update immediately after
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      fileName: params.fileName,
      isPublic,
      createdById: user.id,
      branchId,
      productId: params.entityType === 'product' ? params.entityId : null,
      repairId: params.entityType === 'repair' ? params.entityId : null,
    },
  });

  if (params.entityType === 'product') {
    path = `public/products/${params.entityId}/${pendingAsset.id}-${params.fileName}`;
  } else {
    path = `private/branches/${branchId}/repairs/${params.entityId}/${pendingAsset.id}-${params.fileName}`;
  }

  let url: string | null = null;
  if (isPublic) {
    url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
  }

  const updatedAsset = await prisma.mediaAsset.update({
    where: { id: pendingAsset.id },
    data: { path, url },
  });

  const uploadUrl = await storage.generatePresignedUploadUrl({
    path: updatedAsset.path,
    mimeType: updatedAsset.mimeType,
    sizeLimitBytes: MAX_SIZE_BYTES,
    expirationMs: 5 * 60 * 1000, // 5 minutes
  });

  return { uploadUrl, assetId: updatedAsset.id };
}

export async function registerMedia(assetId: string): Promise<void> {
  await requireAuth();

  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
  });

  if (!asset) {
    throw new Error('Media asset not found.');
  }

  if (asset.state !== MediaState.PENDING) {
    throw new Error('Media asset is not in PENDING state.');
  }

  // Authorize based on entity
  if (asset.productId) {
    await requirePermission('products:write');
  } else if (asset.repairId) {
    await requirePermission('repairs:write');
    if (asset.branchId) {
      await requireBranchAccess(asset.branchId);
    }
  }

  // Server-side verification that the file actually exists in storage
  const metadata = await storage.getObjectMetadata(asset.path);
  if (!metadata) {
    throw new Error('File not found in storage. Did the upload complete?');
  }

  // Validate the content type matches the expected
  if (metadata.contentType !== asset.mimeType) {
    throw new Error('File mime type mismatch in storage.');
  }

  // Update DB record
  await prisma.mediaAsset.update({
    where: { id: assetId },
    data: { state: MediaState.READY },
  });
}

export async function deleteMedia(assetId: string): Promise<void> {
  await requireAuth();

  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
  });

  if (!asset) {
    throw new Error('Media asset not found.');
  }

  // Authorize based on entity
  if (asset.productId) {
    await requirePermission('products:write');
  } else if (asset.repairId) {
    await requirePermission('repairs:write');
    if (asset.branchId) {
      await requireBranchAccess(asset.branchId);
    }
  }

  // Delete from storage
  await storage.deleteObject(asset.path);

  // Delete from DB
  await prisma.mediaAsset.delete({
    where: { id: assetId },
  });
}

export async function getProductMedia(productId: string) {
  await requireAuth();
  await requirePermission('products:read');
  
  return prisma.mediaAsset.findMany({
    where: { 
      productId,
      state: MediaState.READY
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getRepairMedia(repairId: string) {
  await requireAuth();
  await requirePermission('repairs:read');
  
  const repair = await prisma.repair.findUnique({
    where: { id: repairId },
    select: { branchId: true }
  });
  
  if (repair) {
    await requireBranchAccess(repair.branchId);
  }

  return prisma.mediaAsset.findMany({
    where: { 
      repairId,
      state: MediaState.READY
    },
    orderBy: { createdAt: 'desc' }
  });
}
