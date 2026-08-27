import { describe, it, beforeAll, afterAll, vi } from 'vitest';
import assert from 'node:assert';
import 'dotenv/config';

// Mock cookies based on a simple global state we can change per test
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
      if (currentMockCookie.value === 'active_admin') {
        return {
          uid: 'admin_uid',
          email: 'admin@tax.local',
          email_verified: true,
        };
      }
      if (currentMockCookie.value === 'active_unauth') {
        return {
          uid: 'unauth_uid',
          email: 'unauth@tax.local',
          email_verified: true,
        };
      }
      throw new Error('auth/invalid-session-cookie');
    },
  }),
}));

describe('Taxonomy Actions', async () => {
  const prisma = (await import('../prisma')).default;
  const {
    createCategory,
    updateCategory,
    deleteCategory,
    createBrand,
    updateBrand,
    deleteBrand,
  } = await import('./taxonomy-actions');
  const { createProduct } = await import('./actions');

  let branchTax: { id: string };
  let roleAdmin: { id: string };
  let roleUnauth: { id: string };

  beforeAll(async () => {
    // 1. Setup branch
    branchTax = await prisma.branch.upsert({
      where: { code: 'TAX_TEST' },
      update: {},
      create: { name: 'Taxonomy Test Branch', code: 'TAX_TEST' },
    });

    // 2. Setup roles
    roleAdmin = await prisma.role.upsert({
      where: { name: 'Taxonomy Admin' },
      update: {},
      create: { name: 'Taxonomy Admin' },
    });

    roleUnauth = await prisma.role.upsert({
      where: { name: 'Taxonomy Unauth' },
      update: {},
      create: { name: 'Taxonomy Unauth' },
    });

    const requiredPermissions = [
      'products:create',
      'products:update',
      'products:delete',
      'products:read',
      'inventory:write',
      'inventory:read',
    ];
    for (const p of requiredPermissions) {
      const perm = await prisma.permission.upsert({
        where: { name: p },
        update: {},
        create: { name: p, description: p },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleAdmin.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: { roleId: roleAdmin.id, permissionId: perm.id },
      });
    }

    // Clean users
    await prisma.user.deleteMany({
      where: { email: { in: ['admin@tax.local', 'unauth@tax.local'] } },
    });

    await prisma.user.upsert({
      where: { email: 'admin@tax.local' },
      update: {
        firebaseUid: 'admin_uid',
        branchId: branchTax.id,
        roleId: roleAdmin.id,
      },
      create: {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@tax.local',
        firebaseUid: 'admin_uid',
        isActive: true,
        emailVerified: true,
        branchId: branchTax.id,
        roleId: roleAdmin.id,
      },
    });

    await prisma.user.upsert({
      where: { email: 'unauth@tax.local' },
      update: {
        firebaseUid: 'unauth_uid',
        branchId: branchTax.id,
        roleId: roleUnauth.id,
      },
      create: {
        firstName: 'Unauth',
        lastName: 'User',
        email: 'unauth@tax.local',
        firebaseUid: 'unauth_uid',
        isActive: true,
        emailVerified: true,
        branchId: branchTax.id,
        roleId: roleUnauth.id,
      },
    });
  });

  afterAll(async () => {
    // Cleanup products first due to foreign keys
    await prisma.product.deleteMany({
      where: { sku: { startsWith: 'TAX-TEST-' } },
    });
    await prisma.category.deleteMany({
      where: { name: { startsWith: 'TestCategory-' } },
    });
    await prisma.brand.deleteMany({
      where: { name: { startsWith: 'TestBrand-' } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['admin@tax.local', 'unauth@tax.local'] } },
    });
    await prisma.$disconnect();
  });

  describe('Categories', () => {
    let catId: string;

    it('rejects unauthorized creation', async () => {
      currentMockCookie.value = 'active_unauth';
      await assert.rejects(
        createCategory({ name: 'TestCategory-Unauth' }),
        (err: Error) => err.message.includes('Access denied')
      );
    });

    it('creates a category with valid name', async () => {
      currentMockCookie.value = 'active_admin';
      const cat = await createCategory({ name: 'TestCategory-1' });
      assert.ok(cat.id);
      assert.strictEqual(cat.name, 'TestCategory-1');
      catId = cat.id;
    });

    it('rejects empty or whitespace names', async () => {
      currentMockCookie.value = 'active_admin';
      await assert.rejects(createCategory({ name: '   ' }), (err: Error) =>
        err.message.includes('Category name is required')
      );
    });

    it('rejects duplicate names', async () => {
      currentMockCookie.value = 'active_admin';
      await assert.rejects(
        createCategory({ name: 'TestCategory-1' }),
        (err: Error) => err.message.includes('already exists')
      );
    });

    it('updates a category', async () => {
      currentMockCookie.value = 'active_admin';
      const cat = await updateCategory(catId, { name: 'TestCategory-Updated' });
      assert.strictEqual(cat.name, 'TestCategory-Updated');
    });

    it('prevents deletion if assigned to a product', async () => {
      currentMockCookie.value = 'active_admin';
      const prod = await createProduct({
        sku: 'TAX-TEST-CAT-PROD',
        name: 'Product with category',
        categoryId: catId,
      });

      await assert.rejects(deleteCategory(catId), (err: Error) =>
        err.message.includes('assigned to one or more products')
      );

      // Clean up product
      await prisma.product.delete({ where: { id: prod.id } });
    });

    it('deletes a category', async () => {
      currentMockCookie.value = 'active_admin';
      const deleted = await deleteCategory(catId);
      assert.strictEqual(deleted.id, catId);
    });
  });

  describe('Brands', () => {
    let brandId: string;

    it('rejects unauthorized creation', async () => {
      currentMockCookie.value = 'active_unauth';
      await assert.rejects(
        createBrand({ name: 'TestBrand-Unauth' }),
        (err: Error) => err.message.includes('Access denied')
      );
    });

    it('creates a brand with valid name', async () => {
      currentMockCookie.value = 'active_admin';
      const brand = await createBrand({ name: 'TestBrand-1' });
      assert.ok(brand.id);
      assert.strictEqual(brand.name, 'TestBrand-1');
      brandId = brand.id;
    });

    it('rejects empty or whitespace names', async () => {
      currentMockCookie.value = 'active_admin';
      await assert.rejects(createBrand({ name: '' }), (err: Error) =>
        err.message.includes('Brand name is required')
      );
    });

    it('rejects duplicate names', async () => {
      currentMockCookie.value = 'active_admin';
      await assert.rejects(createBrand({ name: 'TestBrand-1' }), (err: Error) =>
        err.message.includes('already exists')
      );
    });

    it('updates a brand', async () => {
      currentMockCookie.value = 'active_admin';
      const brand = await updateBrand(brandId, { name: 'TestBrand-Updated' });
      assert.strictEqual(brand.name, 'TestBrand-Updated');
    });

    it('prevents deletion if assigned to a product', async () => {
      currentMockCookie.value = 'active_admin';
      const prod = await createProduct({
        sku: 'TAX-TEST-BRAND-PROD',
        name: 'Product with brand',
        brandId: brandId,
      });

      await assert.rejects(deleteBrand(brandId), (err: Error) =>
        err.message.includes('assigned to one or more products')
      );

      // Clean up product
      await prisma.product.delete({ where: { id: prod.id } });
    });

    it('deletes a brand', async () => {
      currentMockCookie.value = 'active_admin';
      const deleted = await deleteBrand(brandId);
      assert.strictEqual(deleted.id, brandId);
    });
  });
});
