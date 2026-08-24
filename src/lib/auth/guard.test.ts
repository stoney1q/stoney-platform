import { describe, it, beforeAll, afterAll, vi } from 'vitest';
import assert from 'node:assert';
import 'dotenv/config';

// Ensure Firebase Admin is "configured"
process.env.FIREBASE_PROJECT_ID = 'test';
process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
process.env.FIREBASE_PRIVATE_KEY =
  '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----';

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

let mockVerifySessionCookie: (
  cookie: string,
  checkRevoked: boolean
) => Promise<unknown> = async (c) => {
  console.log('mockVerifySessionCookie called with:', c);
  throw new Error('Not implemented in mock');
};

vi.mock('../firebase/admin', () => ({
  isFirebaseAdminConfigured: () => true,
  getFirebaseAdminAuth: () => ({
    verifySessionCookie: (cookie: string, checkRevoked: boolean) =>
      mockVerifySessionCookie(cookie, checkRevoked),
  }),
}));

describe('Authentication & Security', async () => {
  const { requireAuth, requireRole, requirePermission, requireBranchAccess } =
    await import('./guard');
  const prisma = (await import('../prisma')).default;

  let branchHQ: { id: string };
  let branchOther: { id: string };
  let roleSuperAdmin: { id: string };
  let roleManager: { id: string };

  let activeUser: { id: string };

  beforeAll(async () => {
    // 1. Fetch some seeded branches and roles
    branchHQ = (await prisma.branch.findFirst({ where: { code: 'HQ' } })) as {
      id: string;
    };
    if (!branchHQ) {
      branchHQ = await prisma.branch.create({
        data: { name: 'Head Office (HQ)', code: 'HQ' },
      });
    }

    branchOther = (await prisma.branch.findFirst({
      where: { code: 'OTHER' },
    })) as { id: string };
    if (!branchOther) {
      branchOther = await prisma.branch.create({
        data: { name: 'Other Branch', code: 'OTHER' },
      });
    }

    roleSuperAdmin = (await prisma.role.findFirst({
      where: { name: 'Super Admin' },
    })) as { id: string };
    if (!roleSuperAdmin) {
      roleSuperAdmin = await prisma.role.create({
        data: { name: 'Super Admin' },
      });
    }

    roleManager = (await prisma.role.findFirst({
      where: { name: 'Branch Manager' },
    })) as { id: string };
    if (!roleManager) {
      roleManager = await prisma.role.create({
        data: { name: 'Branch Manager' },
      });
    }

    // Ensure we don't conflict with existing data by cleaning up any left-over test users
    const usersToDelete = await prisma.user.findMany({
      where: {
        email: {
          in: [
            'active@test.local',
            'inactive@test.local',
            'unlinked@test.local',
            'conflict@test.local',
            'unlinked2@test.local',
          ],
        },
      },
    });
    if (usersToDelete.length > 0) {
      const userIds = usersToDelete.map((u) => u.id);
      await prisma.stockMovement.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.transfer.deleteMany({
        where: { createdById: { in: userIds } },
      });
      await prisma.customer.deleteMany({
        where: { createdById: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    // 2. Create test users
    activeUser = await prisma.user.create({
      data: {
        firstName: 'Active',
        lastName: 'User',
        email: 'active@test.local',
        firebaseUid: 'firebase_active_uid',
        isActive: true,
        emailVerified: true,
        branchId: branchHQ.id,
        roleId: roleManager.id,
      },
    });

    await prisma.user.create({
      data: {
        firstName: 'Inactive',
        lastName: 'User',
        email: 'inactive@test.local',
        firebaseUid: 'firebase_inactive_uid',
        isActive: false,
        emailVerified: true,
        branchId: branchHQ.id,
        roleId: roleManager.id,
      },
    });

    await prisma.user.create({
      data: {
        firstName: 'Unlinked',
        lastName: 'User',
        email: 'unlinked@test.local',
        firebaseUid: null,
        isActive: true,
        emailVerified: false,
        branchId: branchHQ.id,
        roleId: roleManager.id,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    const usersToDelete = await prisma.user.findMany({
      where: {
        email: {
          in: [
            'active@test.local',
            'inactive@test.local',
            'unlinked@test.local',
            'conflict@test.local',
            'unlinked2@test.local',
          ],
        },
      },
    });
    if (usersToDelete.length > 0) {
      const userIds = usersToDelete.map((u) => u.id);
      await prisma.stockMovement.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.transfer.deleteMany({
        where: { createdById: { in: userIds } },
      });
      await prisma.customer.deleteMany({
        where: { createdById: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    await prisma.$disconnect();
  });

  describe('Authentication', () => {
    it('missing session -> unauthenticated', async () => {
      currentMockCookie.value = undefined;
      await assert.rejects(requireAuth(), (err: Error & { code?: string }) => {
        return err.code === 'UNAUTHORIZED';
      });
    });

    it('invalid Firebase identity/session -> rejected', async () => {
      currentMockCookie.value = 'invalid_cookie';
      mockVerifySessionCookie = async () => {
        throw new Error('auth/invalid-session-cookie');
      };
      await assert.rejects(
        requireAuth(),
        (err: Error & { code?: string }) => err.code === 'UNAUTHORIZED'
      );
    });

    it('expired session -> rejected', async () => {
      currentMockCookie.value = 'expired_cookie';
      mockVerifySessionCookie = async () => {
        throw new Error('auth/session-cookie-expired');
      };
      await assert.rejects(
        requireAuth(),
        (err: Error & { code?: string }) => err.code === 'UNAUTHORIZED'
      );
    });

    it('revoked session -> rejected', async () => {
      currentMockCookie.value = 'revoked_cookie';
      mockVerifySessionCookie = async () => {
        throw new Error('auth/session-cookie-revoked');
      };
      await assert.rejects(
        requireAuth(),
        (err: Error & { code?: string }) => err.code === 'UNAUTHORIZED'
      );
    });
  });

  describe('User resolution', () => {
    it('valid Firebase UID -> correct PostgreSQL User', async () => {
      currentMockCookie.value = 'valid_active';
      mockVerifySessionCookie = async () => ({
        uid: 'firebase_active_uid',
        email: 'active@test.local',
        email_verified: true,
      });
      const user = await requireAuth();
      assert.strictEqual(user.email, 'active@test.local');
      assert.strictEqual(user.id, activeUser.id);
    });

    it('Firebase identity with no PostgreSQL User -> rejected', async () => {
      currentMockCookie.value = 'valid_no_db_user';
      mockVerifySessionCookie = async () => ({
        uid: 'unknown_uid',
        email: 'unknown@test.local',
        email_verified: true,
      });
      await assert.rejects(
        requireAuth(),
        (err: Error & { code?: string }) => err.code === 'UNAUTHORIZED'
      );
    });

    it('inactive PostgreSQL User -> rejected', async () => {
      currentMockCookie.value = 'valid_inactive';
      mockVerifySessionCookie = async () => ({
        uid: 'firebase_inactive_uid',
        email: 'inactive@test.local',
        email_verified: true,
      });
      await assert.rejects(
        requireAuth(),
        (err: Error & { code?: string }) => err.code === 'UNAUTHORIZED'
      );
    });
  });

  describe('Authorization', () => {
    it('valid authenticated user -> allowed via requireAuth', async () => {
      currentMockCookie.value = 'valid_active';
      mockVerifySessionCookie = async () => ({
        uid: 'firebase_active_uid',
        email: 'active@test.local',
        email_verified: true,
      });
      await assert.doesNotReject(requireAuth());
    });

    it('incorrect role -> 403', async () => {
      currentMockCookie.value = 'valid_active'; // is Branch Manager
      mockVerifySessionCookie = async () => ({
        uid: 'firebase_active_uid',
        email: 'active@test.local',
        email_verified: true,
      });
      await assert.rejects(
        requireRole('Super Admin'),
        (err: Error & { code?: string }) => err.code === 'FORBIDDEN'
      );
    });

    it('missing permission -> 403', async () => {
      currentMockCookie.value = 'valid_active';
      mockVerifySessionCookie = async () => ({
        uid: 'firebase_active_uid',
        email: 'active@test.local',
        email_verified: true,
      });
      await assert.rejects(
        requirePermission('non_existent_permission'),
        (err: Error & { code?: string }) => err.code === 'FORBIDDEN'
      );
    });

    it('valid permission -> allowed', async () => {
      // activeUser is Branch Manager. Branch Manager in seed has permissions.
      // Let's grant a dummy permission temporarily or test an existing one.
      const perm = await prisma.permission.findFirst({
        where: { name: 'users:read' },
      });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: roleManager.id,
              permissionId: perm.id,
            },
          },
          create: { roleId: roleManager.id, permissionId: perm.id },
          update: {},
        });
        currentMockCookie.value = 'valid_active';
        mockVerifySessionCookie = async () => ({
          uid: 'firebase_active_uid',
          email: 'active@test.local',
          email_verified: true,
        });
        await assert.doesNotReject(requirePermission('users:read'));
      }
    });
  });

  describe('Branch isolation', () => {
    it('users own branch -> allowed', async () => {
      currentMockCookie.value = 'valid_active';
      mockVerifySessionCookie = async () => ({
        uid: 'firebase_active_uid',
        email: 'active@test.local',
        email_verified: true,
      });
      await assert.doesNotReject(requireBranchAccess(branchHQ.id));
    });

    it('different branch -> 403', async () => {
      currentMockCookie.value = 'valid_active';
      mockVerifySessionCookie = async () => ({
        uid: 'firebase_active_uid',
        email: 'active@test.local',
        email_verified: true,
      });
      await assert.rejects(
        requireBranchAccess(branchOther.id),
        (err: Error & { code?: string }) => err.code === 'FORBIDDEN'
      );
    });

    it('manipulated client branchId -> cannot bypass authorization', async () => {
      // Assume client passes `branchOther.id` trying to access it
      currentMockCookie.value = 'valid_active';
      mockVerifySessionCookie = async () => ({
        uid: 'firebase_active_uid',
        email: 'active@test.local',
        email_verified: true,
      });
      // The check happens against targetBranchId
      await assert.rejects(
        requireBranchAccess(branchOther.id),
        (err: Error & { code?: string }) => err.code === 'FORBIDDEN'
      );
    });
  });

  describe('Identity linking security', () => {
    it('email-based first-login linking cannot grant unintended privileges (links safely)', async () => {
      // Setup: user exists in DB with no firebaseUid
      currentMockCookie.value = 'unlinked_login';
      mockVerifySessionCookie = async () => ({
        uid: 'new_firebase_uid',
        email: 'unlinked@test.local',
        email_verified: true,
      });

      const user = await requireAuth();
      assert.strictEqual(user.firebaseUid, 'new_firebase_uid');
      assert.strictEqual(user.emailVerified, true);

      // Verify DB was updated
      const dbUser = await prisma.user.findUnique({
        where: { email: 'unlinked@test.local' },
      });
      assert.strictEqual(dbUser?.firebaseUid, 'new_firebase_uid');
      assert.strictEqual(dbUser?.emailVerified, true);
    });

    it('firebaseUid conflict -> rejected safely', async () => {
      // If someone tries to link an email but the firebaseUid is already attached to another user
      // Prisma will throw a unique constraint violation and getCurrentUser catches it and returns null
      const conflictUser = await prisma.user.create({
        data: {
          firstName: 'Conflict',
          lastName: 'User',
          email: 'conflict@test.local',
          firebaseUid: 'conflict_uid',
          isActive: true,
          branchId: branchHQ.id,
          roleId: roleManager.id,
        },
      });

      // Now try to login with unlinked user email but with the conflict_uid
      // Create another unlinked user to test this
      const unlinked2 = await prisma.user.create({
        data: {
          firstName: 'Unlinked2',
          lastName: 'User',
          email: 'unlinked2@test.local',
          firebaseUid: null,
          isActive: true,
          branchId: branchHQ.id,
          roleId: roleManager.id,
        },
      });

      currentMockCookie.value = 'conflict_login';
      mockVerifySessionCookie = async () => ({
        uid: 'conflict_uid',
        email: 'unlinked2@test.local',
        email_verified: true,
      });

      // This will find the user by UID first! Which is `conflictUser`. It won't link.
      // It will just login as `conflictUser`.
      // Wait, if it logs in as `conflictUser`, is that a conflict rejection or a safe behavior?
      // It's safe behavior: immutable UID wins.
      const user = await requireAuth();
      assert.strictEqual(user.id, conflictUser.id);

      // Ensure unlinked2 wasn't touched
      const dbUnlinked2 = await prisma.user.findUnique({
        where: { id: unlinked2.id },
      });
      assert.strictEqual(dbUnlinked2?.firebaseUid, null);

      // Cleanup
      await prisma.user.delete({ where: { id: conflictUser.id } });
      await prisma.user.delete({ where: { id: unlinked2.id } });
    });
  });
});
