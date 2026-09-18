import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.PORTAL_JWT_SECRET;
const JWT_COOKIE_NAME = 'stoney_portal_session';

// A constant dummy value used for timing-safe comparison when contact info is null.
// This ensures that the length of the hashed buffer is always 32 bytes, keeping the timing constant.
const DUMMY_NULL_VALUE = '00000000-0000-0000-0000-000000000000';

function getSecretKey(): Uint8Array {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error(
      'PORTAL_JWT_SECRET is missing or insufficiently long. It must be at least 32 characters.'
    );
  }
  return new TextEncoder().encode(JWT_SECRET);
}

export async function signPortalToken(
  documentId: string,
  type: 'QUOTATION' | 'REPAIR' | 'SALE',
  portalToken: string
): Promise<string> {
  const secretKey = getSecretKey();
  const alg = 'HS256';

  const jwt = await new SignJWT({ documentId, type, portalToken })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secretKey);

  return jwt;
}

export async function verifyPortalCookie(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(JWT_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch {
    // Token is invalid, expired, or signature verification failed
    return null;
  }
}

export async function setPortalCookie(token: string) {
  const cookieStore = await cookies();
  // 2 hours in milliseconds
  const maxAge = 2 * 60 * 60 * 1000;

  cookieStore.set(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAge,
    path: '/',
  });
}

/**
 * Performs a timing-safe string comparison.
 * To prevent length leakage or null pointer exceptions, this hashes both inputs
 * using SHA-256 before performing the timingSafeEqual on the resulting 32-byte buffers.
 */
export function secureCompare(input: string, stored: string | null): boolean {
  // Hash the input
  const inputHash = crypto.createHash('sha256').update(input).digest();

  // Coalesce a null stored value to a dummy string to ensure constant time execution
  const targetToHash = stored === null ? DUMMY_NULL_VALUE : stored;
  const storedHash = crypto.createHash('sha256').update(targetToHash).digest();

  const matches = crypto.timingSafeEqual(inputHash, storedHash);

  // If stored was null, it should never match, even if by astronomical chance the input hashes to the dummy value hash.
  if (stored === null) {
    return false;
  }

  return matches;
}
