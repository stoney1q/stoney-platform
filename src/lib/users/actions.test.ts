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
          uid: 'admin_uid',
          email: 'admin@test.com',
          email_verified: true,
        };
      }
      if (currentMockCookie.value === 'manager_cookie') {
        return {
          uid: 'cashier_uid',
          email: 'cashier@test.com',
          email_verified: true,
        };
      }
      throw new Error('auth/invalid-session-cookie');
    },
  }),
}));

describe('Staff Management Actions', () => {
  let adminUserId: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let managerUserId: string;
  let cashierRoleId: string;
  let branchHQId: string;

  let getStaff: typeof import('./actions').getStaff;
  let provisionStaff: typeof import('./actions').provisionStaff;
  let updateStaff: typeof import('./actions').updateStaff;

  beforeAll(async () => {
    const adminRole = await prisma.role.findFirst({
      where: { name: 'Super Admin' },
    });
    const managerRole = await prisma.role.findFirst({
      where: { name: 'Manager' },
    });
    const cashierRole = await prisma.role.findFirst({
      where: { name: 'Cashier' },
    });
    const branchHQ = await prisma.branch.findFirst({ where: { code: 'HQ' } });

    assert.ok(adminRole && managerRole && cashierRole && branchHQ);
    cashierRoleId = cashierRole.id;
    branchHQId = branchHQ.id;

    const admin = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        firstName: 'Test',
        lastName: 'Admin',
        roleId: adminRole.id,
        branchId: branchHQ.id,
        isActive: true,
        firebaseUid: 'admin_uid',
      },
    });
    adminUserId = admin.id;

    const manager = await prisma.user.create({
      data: {
        email: 'manager@test.com',
        firstName: 'Test',
        lastName: 'Manager',
        roleId: managerRole.id,
        branchId: branchHQ.id,
        isActive: true,
        firebaseUid: 'manager_uid',
      },
    });
    managerUserId = manager.id;

    const actions = await import('./actions');
    getStaff = actions.getStaff;
    provisionStaff = actions.provisionStaff;
    updateStaff = actions.updateStaff;
  });

  afterAll(async () => {
    // Delete test users (including ones created during test)
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'admin@test.com',
            'manager@test.com',
            'newstaff@test.com',
            'updatedstaff@test.com',
          ],
        },
      },
    });
  });

  beforeEach(() => {
    currentMockCookie.value = undefined;
    vi.clearAllMocks();
  });

  it('allows authorized user to get staff', async () => {
    currentMockCookie.value = 'admin_cookie';
    const staff = await getStaff();
    assert.ok(Array.isArray(staff));
    assert.ok(staff.length >= 2);
  });

  it('allows authorized user to provision staff', async () => {
    currentMockCookie.value = 'admin_cookie';
    const formData = new FormData();
    formData.append('email', 'newstaff@test.com');
    formData.append('firstName', 'New');
    formData.append('lastName', 'Staff');
    formData.append('roleId', cashierRoleId);
    formData.append('branchId', branchHQId);

    const staff = await provisionStaff(formData);
    assert.strictEqual(staff.email, 'newstaff@test.com');
    assert.strictEqual(staff.firstName, 'New');
    assert.strictEqual(staff.isActive, true);
    assert.strictEqual(staff.emailVerified, false);
  });

  it('prevents provisioning with duplicate email', async () => {
    currentMockCookie.value = 'admin_cookie';
    const formData = new FormData();
    formData.append('email', 'newstaff@test.com'); // Duplicate
    formData.append('firstName', 'Dup');
    formData.append('lastName', 'Staff');
    formData.append('roleId', cashierRoleId);
    formData.append('branchId', branchHQId);

    await assert.rejects(provisionStaff(formData), /already exists/);
  });

  it('allows authorized user to update staff', async () => {
    currentMockCookie.value = 'admin_cookie';
    const existing = await prisma.user.findUnique({
      where: { email: 'newstaff@test.com' },
    });
    assert.ok(existing);

    const formData = new FormData();
    formData.append('userId', existing.id);
    formData.append('email', 'updatedstaff@test.com');
    formData.append('firstName', 'Updated');
    formData.append('lastName', 'Staff');
    formData.append('roleId', cashierRoleId);
    formData.append('branchId', branchHQId);
    formData.append('isActive', 'false');

    const updated = await updateStaff(formData);
    assert.strictEqual(updated.email, 'updatedstaff@test.com');
    assert.strictEqual(updated.firstName, 'Updated');
    assert.strictEqual(updated.isActive, false);
  });

  it('prevents user from modifying themselves via updateStaff', async () => {
    currentMockCookie.value = 'admin_cookie';
    const formData = new FormData();
    formData.append('userId', adminUserId);
    formData.append('email', 'admin@test.com');
    formData.append('firstName', 'Hacked');
    formData.append('lastName', 'Admin');
    formData.append('roleId', cashierRoleId);
    formData.append('branchId', branchHQId);
    formData.append('isActive', 'true');

    await assert.rejects(updateStaff(formData), /cannot modify your own/);
  });
});
