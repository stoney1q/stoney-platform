import 'server-only';
import { cookies } from 'next/headers';

import {
  getFirebaseAdminAuth,
  isFirebaseAdminConfigured,
} from '../firebase/admin';
import prisma from '../prisma';
import { AUTH_COOKIE_NAME, type AuthenticatedUser } from './types';

/**
 * Custom error type for authentication and authorization guard failures.
 */
export class AuthError extends Error {
  public readonly statusCode: number;
  public readonly code:
    'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_PROVISIONED' | 'INACTIVE_USER';

  constructor(
    message: string,
    statusCode: number,
    code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_PROVISIONED' | 'INACTIVE_USER'
  ) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Resolves the authenticated user context from the incoming request session cookie.
 * 1. Reads the HTTP-only session cookie.
 * 2. Verifies the session cookie against Firebase Admin Auth with revocation checks.
 * 3. Resolves the user record, branch, role, and permissions from PostgreSQL via Prisma.
 * 4. Atomically links firebaseUid if the user was matched by verified email during onboarding.
 *
 * Returns null if no valid session is present.
 */
export async function getCurrentUser(
  sessionCookieOverride?: string
): Promise<AuthenticatedUser | null> {
  if (!isFirebaseAdminConfigured()) {
    return null;
  }

  let sessionCookie = sessionCookieOverride;
  if (!sessionCookie) {
    try {
      const cookieStore = await cookies();
      sessionCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    } catch {
      // Invoked outside of Next.js request context
      return null;
    }
  }

  if (!sessionCookie) {
    return null;
  }

  try {
    const adminAuth = getFirebaseAdminAuth();
    // verifySessionCookie with checkRevoked = true ensures revoked tokens/sessions are rejected
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true
    );
    const firebaseUid = decodedToken.uid;
    const tokenEmail = decodedToken.email;

    // 1. Primary lookup by immutable Firebase UID
    let dbUser = await prisma.user.findUnique({
      where: { firebaseUid },
      include: {
        branch: true,
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    // 2. Fallback lookup by email for initial linking (if firebaseUid is not yet set)
    if (!dbUser && tokenEmail) {
      const userByEmail = await prisma.user.findUnique({
        where: { email: tokenEmail },
        include: {
          branch: true,
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      if (userByEmail && !userByEmail.firebaseUid) {
        // Atomically link Firebase UID to the PostgreSQL User record
        dbUser = await prisma.user.update({
          where: { id: userByEmail.id },
          data: {
            firebaseUid,
            emailVerified: Boolean(decodedToken.email_verified),
          },
          include: {
            branch: true,
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        });
      }
    }

    if (!dbUser || !dbUser.isActive) {
      return null;
    }

    // Resolve permissions array
    const permissions: string[] = [];
    if (dbUser.role) {
      if (dbUser.role.name === 'Super Admin') {
        // Super Admin receives all foundational permissions
        const allPermissions = await prisma.permission.findMany({
          select: { name: true },
        });
        permissions.push(...allPermissions.map((p) => p.name));
      } else if (dbUser.role.rolePermissions) {
        for (const rp of dbUser.role.rolePermissions) {
          if (rp.permission?.name) {
            permissions.push(rp.permission.name);
          }
        }
      }
    }

    return {
      id: dbUser.id,
      firebaseUid,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      phone: dbUser.phone,
      avatar: dbUser.avatar,
      emailVerified: dbUser.emailVerified,
      isActive: dbUser.isActive,
      branchId: dbUser.branchId,
      branch: {
        id: dbUser.branch.id,
        code: dbUser.branch.code,
        name: dbUser.branch.name,
        isActive: dbUser.branch.isActive,
      },
      roleId: dbUser.roleId,
      role: {
        id: dbUser.role.id,
        name: dbUser.role.name,
        description: dbUser.role.description,
      },
      permissions: Array.from(new Set(permissions)),
    };
  } catch (error) {
    console.error('getCurrentUser Error:', error);
    return null;
  }
}

/**
 * Requires the current request to be authenticated.
 * Throws 401 AuthError if no authenticated user session exists.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError(
      'Authentication required. Please sign in to proceed.',
      401,
      'UNAUTHORIZED'
    );
  }
  return user;
}

/**
 * Requires the authenticated user to hold a specific role.
 * Super Admin bypasses role checks.
 * Throws 403 AuthError if the user's role does not match.
 */
export async function requireRole(
  roleName: string
): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (user.role.name !== roleName && user.role.name !== 'Super Admin') {
    throw new AuthError(
      `Access denied. Role "${roleName}" is required.`,
      403,
      'FORBIDDEN'
    );
  }
  return user;
}

/**
 * Requires the authenticated user to hold a specific fine-grained permission.
 * Super Admin bypasses permission checks.
 * Throws 403 AuthError if the user lacks the required permission.
 */
export async function requirePermission(
  permissionName: string
): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (
    user.role.name === 'Super Admin' ||
    user.permissions.includes(permissionName)
  ) {
    return user;
  }
  throw new AuthError(
    `Access denied. Permission "${permissionName}" is required.`,
    403,
    'FORBIDDEN'
  );
}

/**
 * Enforces branch isolation on server actions and route handlers.
 * Super Admin and users with 'branches:read' bypass branch isolation.
 * Throws 403 AuthError if the user attempts to access a branch outside their assignment.
 */
export async function requireBranchAccess(
  targetBranchId: string
): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (
    user.role.name === 'Super Admin' ||
    user.permissions.includes('branches:read') ||
    user.branchId === targetBranchId
  ) {
    return user;
  }
  throw new AuthError(
    'Access denied. You do not have permission to access records for this branch.',
    403,
    'FORBIDDEN'
  );
}
