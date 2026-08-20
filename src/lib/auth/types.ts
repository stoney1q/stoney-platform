/**
 * Represents the fully resolved user context available to every authorized server operation.
 * Sourced from PostgreSQL/Prisma after verifying the Firebase ID token or session cookie.
 */
export interface AuthenticatedUser {
  id: string;
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatar: string | null;
  emailVerified: boolean;
  isActive: boolean;
  branchId: string;
  branch: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  };
  roleId: string;
  role: {
    id: string;
    name: string;
    description: string | null;
  };
  permissions: string[];
}

/**
 * Standard session cookie configuration constants.
 */
export const AUTH_COOKIE_NAME = 'stoney_session';
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 5; // 5 days in seconds
