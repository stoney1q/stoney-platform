import { describe, it, beforeAll, afterAll, vi, expect } from 'vitest';
import assert from 'node:assert';
import 'dotenv/config';
import { MediaState } from '@/generated/prisma/client';

const { currentMockCookie } = vi.hoisted(() => ({
  currentMockCookie: { value: undefined as string | undefined },
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === 'stoney_session' && currentMockCookie.value !== undefined) {
        return { value: currentMockCookie.value };
      }
      return undefined;
    },
  }),
}));

vi.mock('../firebase/admin', () => ({
  isFirebaseAdminConfigured: () => true,
  getFirebaseAdminAuth: () => ({
    verifySessionCookie: async () => {
      if (currentMockCookie.value === 'active_hq_user') {
        return { uid: 'hq_uid', email: 'hq@test.local', email_verified: true };
      }
      if (currentMockCookie.value === 'active_other_user') {
        return {
          uid: 'other_inv_uid',
          email: 'other@test.local',
          email_verified: true,
        };
      }
      throw new Error('auth/invalid-session-cookie');
    },
  }),
}));

const mockStorage = vi.hoisted(() => ({
  generatePresignedUploadUrl: vi.fn().mockResolvedValue('https://fake-url.com'),
  deleteObject: vi.fn().mockResolvedValue(undefined),
  getObjectMetadata: vi.fn().mockResolvedValue({ size: 100, contentType: 'image/jpeg' }),
  getObjectStream: vi.fn(),
}));

vi.mock('./storage', () => ({
  storage: mockStorage,
}));

describe('Media Actions & Security', async () => {
  const prisma = (await import('../prisma')).default;
  const { generateUploadUrl, registerMedia } = await import('./actions');
  const { deleteProduct } = await import('../inventory/actions');

  let branchHQ: { id: string };
  let branchOther: { id: string };
  let testProd: { id: string };
  let hqCustomer: { id: string };
  let hqDevice: { id: string };
  let otherRepair: { id: string };
  let hqUser: { id: string };

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test-bucket.appspot.com';

    branchHQ = await prisma.branch.upsert({
      where: { code: 'HQ' },
      update: {},
      create: { name: 'Head Office', code: 'HQ' },
    });
    branchOther = await prisma.branch.upsert({
      where: { code: 'OTHER' },
      update: {},
      create: { name: 'Other Branch', code: 'OTHER' },
    });

    const roleManager = await prisma.role.upsert({
      where: { name: 'Branch Manager' },
      update: {},
      create: { name: 'Branch Manager' },
    });

    const requiredPermissions = ['products:write', 'repairs:write', 'inventory:write'];
    for (const p of requiredPermissions) {
      const perm = await prisma.permission.upsert({
        where: { name: p },
        update: {},
        create: { name: p, description: p },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleManager.id, permissionId: perm.id } },
        update: {},
        create: { roleId: roleManager.id, permissionId: perm.id },
      });
    }

    hqUser = await prisma.user.upsert({
      where: { email: 'hq@test.local' },
      update: { firebaseUid: 'hq_uid', branchId: branchHQ.id, roleId: roleManager.id },
      create: {
        firstName: 'HQ', lastName: 'User', email: 'hq@test.local',
        firebaseUid: 'hq_uid', isActive: true, emailVerified: true,
        branchId: branchHQ.id, roleId: roleManager.id,
      },
    });

    await prisma.user.upsert({
      where: { email: 'other@test.local' },
      update: { firebaseUid: 'other_inv_uid', branchId: branchOther.id, roleId: roleManager.id },
      create: {
        firstName: 'Other', lastName: 'User', email: 'other@test.local',
        firebaseUid: 'other_inv_uid', isActive: true, emailVerified: true,
        branchId: branchOther.id, roleId: roleManager.id,
      },
    });

    testProd = await prisma.product.upsert({
      where: { sku: 'TEST-PROD-MEDIA' },
      update: {},
      create: { sku: 'TEST-PROD-MEDIA', name: 'Media Prod' }
    });

    hqCustomer = await prisma.customer.upsert({
      where: { id: 'TEST-CUSTOMER-1' },
      update: {},
      create: { id: 'TEST-CUSTOMER-1', firstName: 'HQ', lastName: 'Customer', createdById: hqUser.id }
    });

    hqDevice = await prisma.device.upsert({
      where: { id: 'TEST-DEVICE-1' },
      update: {},
      create: { id: 'TEST-DEVICE-1', customerId: hqCustomer.id, make: 'Test', model: 'Device' }
    });

    // Repair doesn't have a unique field easily guessable, so let's delete any existing one first
    await prisma.repair.deleteMany({
      where: { deviceId: hqDevice.id }
    });

    otherRepair = await prisma.repair.create({
      data: {
        branchId: branchOther.id, customerId: hqCustomer.id, deviceId: hqDevice.id, issue: 'Broken'
      }
    });
  });

  afterAll(async () => {
    await prisma.mediaAsset.deleteMany({
      where: { bucket: 'test-bucket.appspot.com' }
    });
    await prisma.repair.deleteMany({ where: { id: otherRepair.id } });
    await prisma.device.deleteMany({ where: { id: hqDevice.id } });
    await prisma.customer.deleteMany({ where: { id: hqCustomer.id } });
    await prisma.product.deleteMany({ where: { sku: 'TEST-PROD-MEDIA' } });
    await prisma.product.deleteMany({ where: { sku: 'TEST-DEL-MEDIA' } });
    try {
      await prisma.user.deleteMany({ where: { email: { in: ['hq@test.local', 'other@test.local'] } } });
    } catch {
      // Ignore user cleanup errors
    }
    await prisma.$disconnect();
  });

  it('generates upload url for product and sets public direct URL', async () => {
    currentMockCookie.value = 'active_hq_user';
    const res = await generateUploadUrl({
      entityType: 'product',
      entityId: testProd.id,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      fileName: 'test.jpg'
    });

    assert.ok(res.uploadUrl);
    assert.ok(res.assetId);

    const asset = await prisma.mediaAsset.findUnique({ where: { id: res.assetId } });
    assert.ok(asset);
    assert.strictEqual(asset.state, MediaState.PENDING);
    assert.strictEqual(asset.productId, testProd.id);
    assert.strictEqual(asset.isPublic, true);
    assert.ok(asset.url?.includes('firebasestorage.googleapis.com'));
  });

  it('generates upload url for repair and ensures URL is null (private)', async () => {
    currentMockCookie.value = 'active_other_user';
    const res = await generateUploadUrl({
      entityType: 'repair',
      entityId: otherRepair.id,
      mimeType: 'image/png',
      sizeBytes: 2048,
      fileName: 'private.png'
    });

    const asset = await prisma.mediaAsset.findUnique({ where: { id: res.assetId } });
    assert.ok(asset);
    assert.strictEqual(asset.state, MediaState.PENDING);
    assert.strictEqual(asset.repairId, otherRepair.id);
    assert.strictEqual(asset.isPublic, false);
    assert.strictEqual(asset.url, null); // Private media must not have a direct public URL
  });

  it('fails to generate upload url for repair in another branch', async () => {
    currentMockCookie.value = 'active_hq_user';
    await assert.rejects(
      generateUploadUrl({
        entityType: 'repair',
        entityId: otherRepair.id,
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        fileName: 'test.jpg'
      }),
      (err: Error) => err.message.includes('Access denied')
    );
  });

  it('rejects oversized files', async () => {
    currentMockCookie.value = 'active_hq_user';
    await assert.rejects(
      generateUploadUrl({
        entityType: 'product',
        entityId: testProd.id,
        mimeType: 'image/jpeg',
        sizeBytes: 10 * 1024 * 1024,
        fileName: 'huge.jpg'
      }),
      (err: Error) => err.message.includes('exceeds the 5MB limit')
    );
  });

  it('registers media if storage verification passes', async () => {
    currentMockCookie.value = 'active_hq_user';
    mockStorage.getObjectMetadata.mockResolvedValueOnce({ size: 1024, contentType: 'image/jpeg' });
    
    const { assetId } = await generateUploadUrl({
      entityType: 'product',
      entityId: testProd.id,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      fileName: 'test2.jpg'
    });

    await registerMedia(assetId);

    const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
    assert.strictEqual(asset!.state, MediaState.READY);
  });

  it('fails to register if storage metadata is missing (not uploaded)', async () => {
    currentMockCookie.value = 'active_hq_user';
    mockStorage.getObjectMetadata.mockResolvedValueOnce(null);
    
    const { assetId } = await generateUploadUrl({
      entityType: 'product',
      entityId: testProd.id,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      fileName: 'test3.jpg'
    });

    await assert.rejects(
      registerMedia(assetId),
      (err: Error) => err.message.includes('File not found in storage')
    );
  });

  it('fails to register if mime type is forged', async () => {
    currentMockCookie.value = 'active_hq_user';
    // Storage metadata returns application/x-msdownload (exe)
    mockStorage.getObjectMetadata.mockResolvedValueOnce({ size: 1024, contentType: 'application/x-msdownload' });
    
    const { assetId } = await generateUploadUrl({
      entityType: 'product',
      entityId: testProd.id,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      fileName: 'fake.jpg'
    });

    await assert.rejects(
      registerMedia(assetId),
      (err: Error) => err.message.includes('File mime type mismatch')
    );
  });

  it('fails to transition from READY to READY', async () => {
    currentMockCookie.value = 'active_hq_user';
    mockStorage.getObjectMetadata.mockResolvedValueOnce({ size: 1024, contentType: 'image/jpeg' });
    
    const { assetId } = await generateUploadUrl({
      entityType: 'product',
      entityId: testProd.id,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      fileName: 'test4.jpg'
    });

    await registerMedia(assetId);

    // Try again
    await assert.rejects(
      registerMedia(assetId),
      (err: Error) => err.message.includes('not in PENDING state')
    );
  });

  it('cleans up GCS media when product is deleted', async () => {
    currentMockCookie.value = 'active_hq_user';
    const prod = await prisma.product.upsert({
      where: { sku: 'TEST-DEL-MEDIA' },
      update: {},
      create: { sku: 'TEST-DEL-MEDIA', name: 'Del Media Prod' }
    });

    mockStorage.getObjectMetadata.mockResolvedValueOnce({ size: 1024, contentType: 'image/jpeg' });
    
    const { assetId } = await generateUploadUrl({
      entityType: 'product',
      entityId: prod.id,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      fileName: 'del.jpg'
    });

    await registerMedia(assetId);

    // Delete product
    mockStorage.deleteObject.mockClear();
    await deleteProduct(prod.id);

    // Check storage.deleteObject was called
    expect(mockStorage.deleteObject).toHaveBeenCalledTimes(1);

    // Check product and media are gone
    const p = await prisma.product.findUnique({ where: { id: prod.id } });
    assert.strictEqual(p, null);

    const m = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
    assert.strictEqual(m, null);
  });
});
