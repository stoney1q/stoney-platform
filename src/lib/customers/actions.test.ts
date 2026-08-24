import { describe, it, beforeAll, afterAll, vi } from 'vitest';
import assert from 'node:assert';
import 'dotenv/config';

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
          uid: 'admin_cust_uid',
          email: 'admin_cust@test.local',
          email_verified: true,
        };
      }
      if (currentMockCookie.value === 'active_unauth') {
        return {
          uid: 'unauth_cust_uid',
          email: 'unauth_cust@test.local',
          email_verified: true,
        };
      }
      throw new Error('auth/invalid-session-cookie');
    },
  }),
}));

describe('Customer Actions', async () => {
  const { prisma } = await import('@/lib/prisma');
  const {
    createCustomer,
    updateCustomer,
    deactivateCustomer,
    searchCustomers,
    getCustomer,
  } = await import('./actions');

  let adminUserId: string;

  beforeAll(async () => {
    const permissionKeys = [
      'customers:read',
      'customers:create',
      'customers:update',
      'customers:delete',
    ];

    const perms = await Promise.all(
      permissionKeys.map((name) =>
        prisma.permission.upsert({
          where: { name },
          update: {},
          create: { name, description: `Test ${name}` },
        })
      )
    );

    const branch = await prisma.branch.upsert({
      where: { code: 'CUS_HQ' },
      update: {},
      create: { name: 'Test HQ', code: 'CUS_HQ', isActive: true },
    });

    const adminRole = await prisma.role.upsert({
      where: { name: 'Customer Admin' },
      update: {},
      create: { name: 'Customer Admin' },
    });

    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
      skipDuplicates: true,
    });

    const unauthRole = await prisma.role.upsert({
      where: { name: 'Customer Unauth' },
      update: {},
      create: { name: 'Customer Unauth' },
    });

    const adminUser = await prisma.user.upsert({
      where: { email: 'admin_cust@test.local' },
      update: {
        firebaseUid: 'admin_cust_uid',
        branchId: branch.id,
        roleId: adminRole.id,
      },
      create: {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin_cust@test.local',
        firebaseUid: 'admin_cust_uid',
        branchId: branch.id,
        roleId: adminRole.id,
      },
    });
    adminUserId = adminUser.id;

    await prisma.user.upsert({
      where: { email: 'unauth_cust@test.local' },
      update: {
        firebaseUid: 'unauth_cust_uid',
        branchId: branch.id,
        roleId: unauthRole.id,
      },
      create: {
        firstName: 'Unauth',
        lastName: 'User',
        email: 'unauth_cust@test.local',
        firebaseUid: 'unauth_cust_uid',
        branchId: branch.id,
        roleId: unauthRole.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { createdById: adminUserId } });
    await prisma.user.deleteMany({
      where: { firebaseUid: { in: ['admin_cust_uid', 'unauth_cust_uid'] } },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { name: { in: ['Customer Admin', 'Customer Unauth'] } } },
    });
    await prisma.role.deleteMany({
      where: { name: { in: ['Customer Admin', 'Customer Unauth'] } },
    });
    await prisma.branch.deleteMany({ where: { code: 'CUS_HQ' } });
  });

  it('1. Valid customer creation', async () => {
    currentMockCookie.value = 'active_admin';
    const res = await createCustomer({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      phone: '1234567890',
      alternatePhone: '',
      address: '',
      isActive: true,
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data?.firstName, 'Alice');
    assert.strictEqual(res.data?.email, 'alice@example.com');
  });

  it('2. Missing first name rejected', async () => {
    currentMockCookie.value = 'active_admin';
    const res = await createCustomer({
      firstName: '',
      lastName: 'Smith',
      email: 'alice2@example.com',
      phone: '',
      alternatePhone: '',
      address: '',
      isActive: true,
    });
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /First name is required/);
  });

  it('3. Missing last name rejected', async () => {
    currentMockCookie.value = 'active_admin';
    const res = await createCustomer({
      firstName: 'Bob',
      lastName: '',
      email: 'bob@example.com',
      phone: '',
      alternatePhone: '',
      address: '',
      isActive: true,
    });
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /Last name is required/);
  });

  it('4. Missing both email and phone rejected', async () => {
    currentMockCookie.value = 'active_admin';
    const res = await createCustomer({
      firstName: 'Bob',
      lastName: 'Jones',
      email: '',
      phone: '',
      alternatePhone: '',
      address: '',
      isActive: true,
    });
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /Either email or phone is required/);
  });

  it('5. Invalid email rejected', async () => {
    currentMockCookie.value = 'active_admin';
    const res = await createCustomer({
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'invalid-email',
      phone: '',
      alternatePhone: '',
      address: '',
      isActive: true,
    });
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /Invalid email address/);
  });

  it('6. Duplicate email produces warning', async () => {
    currentMockCookie.value = 'active_admin';
    const res = await createCustomer({
      firstName: 'Alice Duplicate',
      lastName: 'Smith',
      email: 'alice@example.com',
      phone: '',
      alternatePhone: '',
      address: '',
      isActive: true,
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.warning);
    assert.strictEqual(res.warning?.duplicateMatches.length, 1);
  });

  it('7. Duplicate phone produces warning', async () => {
    currentMockCookie.value = 'active_admin';
    const res = await createCustomer({
      firstName: 'Alice Phone Dup',
      lastName: 'Smith',
      email: 'alice3@example.com',
      phone: '1234567890',
      alternatePhone: '',
      address: '',
      isActive: true,
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.warning);
  });

  it('8 & 9. Customer number generated safely and is unique', async () => {
    currentMockCookie.value = 'active_admin';
    const res1 = await createCustomer({
      firstName: 'Seq1',
      lastName: 'User',
      email: 'seq1@example.com',
      phone: '1111111',
      alternatePhone: '',
      address: '',
      isActive: true,
    });
    const res2 = await createCustomer({
      firstName: 'Seq2',
      lastName: 'User',
      email: 'seq2@example.com',
      phone: '2222222',
      alternatePhone: '',
      address: '',
      isActive: true,
    });
    assert.ok(res1.data?.sequence);
    assert.ok(res2.data?.sequence);
    assert.notStrictEqual(res1.data?.sequence, res2.data?.sequence);
    assert.strictEqual(res2.data.sequence, res1.data.sequence + 1);
  });

  it('10. Customer update works', async () => {
    currentMockCookie.value = 'active_admin';
    const customer = await createCustomer({
      firstName: 'Update',
      lastName: 'Me',
      email: 'update@example.com',
      phone: '3333333',
      alternatePhone: '',
      address: '',
      isActive: true,
    });

    const updateRes = await updateCustomer(customer.data!.id, {
      firstName: 'Updated',
      lastName: 'Me',
      email: 'update@example.com',
      phone: '999999999',
      alternatePhone: '',
      address: '',
      isActive: true,
    });

    assert.strictEqual(updateRes.success, true);
    assert.strictEqual(updateRes.data!.firstName, 'Updated');
    assert.strictEqual(updateRes.data!.phone, '999999999');
  });

  it('11 & 12. Customer deactivation works and customer remains in db', async () => {
    currentMockCookie.value = 'active_admin';
    const customer = await createCustomer({
      firstName: 'Delete',
      lastName: 'Me',
      email: 'delete@example.com',
      phone: '4444444',
      alternatePhone: '',
      address: '',
      isActive: true,
    });

    const res = await deactivateCustomer(customer.data!.id);
    assert.strictEqual(res.success, true);

    const fetched = await getCustomer(customer.data!.id);
    assert.strictEqual(fetched.data?.isActive, false);
  });

  it('13-16. Unauthorized actions rejected', async () => {
    currentMockCookie.value = 'active_unauth';

    const readRes = await searchCustomers({});
    assert.strictEqual(readRes.success, false);
    assert.match(readRes.error || '', /Access denied/);

    const createRes = await createCustomer({
      firstName: 'Hack',
      lastName: 'Er',
      email: 'hacker@example.com',
      phone: '5555555',
      alternatePhone: '',
      address: '',
      isActive: true,
    });
    assert.strictEqual(createRes.success, false);
    assert.match(createRes.error || '', /Access denied/);

    const updateRes = await updateCustomer('some-id', {
      firstName: 'Hack',
      lastName: 'Er',
      email: '',
      phone: '1111111',
      alternatePhone: '',
      address: '',
      isActive: true,
    });
    assert.strictEqual(updateRes.success, false);

    const deleteRes = await deactivateCustomer('some-id');
    assert.strictEqual(deleteRes.success, false);
  });

  it('17. createdById comes from server session', async () => {
    currentMockCookie.value = 'active_admin';
    const customer = await createCustomer({
      firstName: 'Session',
      lastName: 'Test',
      email: 'session@example.com',
      phone: '6666666',
      alternatePhone: '',
      address: '',
      isActive: true,
    });
    assert.strictEqual(customer.data?.createdById, adminUserId);
  });

  it('18, 19, 20. Search, pagination, and inactive filtering works', async () => {
    currentMockCookie.value = 'active_admin';
    const searchAll = await searchCustomers({ query: 'Alice' });
    assert.strictEqual(searchAll.success, true);
    assert.ok(
      searchAll.data?.customers.some(
        (c: { firstName: string }) => c.firstName === 'Alice'
      )
    );

    const searchSmith = await searchCustomers({ query: 'Smith' });
    assert.strictEqual(searchSmith.success, true);
    assert.ok(searchSmith.data!.customers.length > 0);

    const searchActive = await searchCustomers({
      activeOnly: true,
      query: 'Delete',
    });
    assert.strictEqual(searchActive.data?.customers.length, 0);

    const searchInactive = await searchCustomers({
      activeOnly: false,
      query: 'Delete',
    });
    assert.strictEqual(searchInactive.data?.customers.length, 1);
  });
});
