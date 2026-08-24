import { describe, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as assert from 'node:assert';
import prisma from '../prisma';

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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../firebase/admin', () => ({
  isFirebaseAdminConfigured: () => true,
  getFirebaseAdminAuth: () => ({
    verifySessionCookie: async () => {
      if (currentMockCookie.value === 'admin_cookie') {
        return {
          uid: 'admin_branch_uid',
          email: 'admin_branch@test.com',
          email_verified: true,
        };
      }
      if (currentMockCookie.value === 'cashier_cookie') {
        return {
          uid: 'cashier_branch_uid',
          email: 'cashier_branch@test.com',
          email_verified: true,
        };
      }
      throw new Error('auth/invalid-session-cookie');
    },
  }),
}));

describe('Branch Management Actions', () => {
  let adminUserId: string;
  // Initialize shared dependencies
  let cashierUserId: string;
  // Dynamic imports for actions to ensure mocks take effect
  let getBranches: typeof import('./actions').getBranches;
  let createBranch: typeof import('./actions').createBranch;
  let updateBranch: typeof import('./actions').updateBranch;

  beforeAll(async () => {
    // Setup roles
    let adminRole = await prisma.role.findFirst({
      where: { name: 'Super Admin' },
    });
    if (!adminRole)
      adminRole = await prisma.role.create({ data: { name: 'Super Admin' } });

    let cashierRole = await prisma.role.findFirst({
      where: { name: 'Cashier' },
    });
    if (!cashierRole)
      cashierRole = await prisma.role.create({ data: { name: 'Cashier' } });

    let branchHQ = await prisma.branch.findFirst({ where: { code: 'HQ' } });
    if (!branchHQ)
      branchHQ = await prisma.branch.create({
        data: { name: 'Head Office (HQ)', code: 'HQ', isActive: true },
      });

    assert.ok(adminRole && cashierRole && branchHQ);

    // Create users
    const admin = await prisma.user.upsert({
      where: { email: 'admin_branch@test.com' },
      update: {
        roleId: adminRole.id,
        branchId: branchHQ.id,
        firebaseUid: 'admin_branch_uid',
      },
      create: {
        email: 'admin_branch@test.com',
        firstName: 'Test',
        lastName: 'Admin',
        roleId: adminRole.id,
        branchId: branchHQ.id,
        isActive: true,
        firebaseUid: 'admin_branch_uid',
      },
    });
    adminUserId = admin.id;

    const cashier = await prisma.user.upsert({
      where: { email: 'cashier_branch@test.com' },
      update: {
        roleId: cashierRole.id,
        branchId: branchHQ.id,
        firebaseUid: 'cashier_branch_uid',
      },
      create: {
        email: 'cashier_branch@test.com',
        firstName: 'Test',
        lastName: 'Cashier',
        roleId: cashierRole.id,
        branchId: branchHQ.id,
        isActive: true,
        firebaseUid: 'cashier_branch_uid',
      },
    });
    cashierUserId = cashier.id;

    const actions = await import('./actions');
    getBranches = actions.getBranches;
    createBranch = actions.createBranch;
    updateBranch = actions.updateBranch;
  });

  afterAll(async () => {
    // Clean up created entities to avoid leaking into other tests
    const usersToDelete = [adminUserId, cashierUserId].filter(Boolean);
    if (usersToDelete.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: usersToDelete } },
      });
    }
    await prisma.branch.deleteMany({
      where: { code: { in: ['TEST_BR', 'TEST_BR_UP'] } },
    });
  });

  beforeEach(() => {
    currentMockCookie.value = undefined;
    vi.clearAllMocks();
  });

  it('allows authorized user to get branches', async () => {
    currentMockCookie.value = 'admin_cookie';
    const branches = await getBranches();
    assert.ok(Array.isArray(branches));
    assert.ok(branches.length > 0);
  });

  it('prevents unauthorized user from getting branches', async () => {
    currentMockCookie.value = 'cashier_cookie'; // Cashier lacks branches:read
    await assert.rejects(
      getBranches(),
      (err: Error & { code?: string }) => err.code === 'FORBIDDEN'
    );
  });

  it('allows authorized user to create a branch', async () => {
    currentMockCookie.value = 'admin_cookie';
    const formData = new FormData();
    formData.append('name', 'Test Branch');
    formData.append('code', 'TEST_BR');
    formData.append('address', '123 Test St');
    formData.append('isActive', 'true');

    const branch = await createBranch(formData);
    assert.strictEqual(branch.name, 'Test Branch');
    assert.strictEqual(branch.code, 'TEST_BR');
    assert.strictEqual(branch.isActive, true);
  });

  it('prevents creating branch with duplicate code', async () => {
    currentMockCookie.value = 'admin_cookie';
    const formData = new FormData();
    formData.append('name', 'Another Test');
    formData.append('code', 'TEST_BR'); // Duplicate

    await assert.rejects(createBranch(formData), /Branch code must be unique/);
  });

  it('allows authorized user to update a branch', async () => {
    currentMockCookie.value = 'admin_cookie';
    const existing = await prisma.branch.findUnique({
      where: { code: 'TEST_BR' },
    });
    assert.ok(existing);

    const formData = new FormData();
    formData.append('branchId', existing.id);
    formData.append('name', 'Updated Branch');
    formData.append('code', 'TEST_BR_UP');
    formData.append('isActive', 'false');

    const updated = await updateBranch(formData);
    assert.strictEqual(updated.name, 'Updated Branch');
    assert.strictEqual(updated.code, 'TEST_BR_UP');
    assert.strictEqual(updated.isActive, false);
  });

  it('prevents unauthorized user from creating branch', async () => {
    currentMockCookie.value = 'cashier_cookie'; // Cashier lacks branches:create
    const formData = new FormData();
    formData.append('name', 'Test Branch 2');
    formData.append('code', 'TEST_BR2');

    await assert.rejects(
      createBranch(formData),
      (err: Error & { code?: string }) => err.code === 'FORBIDDEN'
    );
  });
});
