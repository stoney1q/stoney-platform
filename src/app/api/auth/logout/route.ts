import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getFirebaseAdminAuth,
  isFirebaseAdminConfigured,
} from '@/lib/firebase/admin';
import { AUTH_COOKIE_NAME } from '@/lib/auth/types';

/**
 * POST /api/auth/logout
 * Clears the session cookie and revokes Firebase refresh tokens if session exists.
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (sessionCookie && isFirebaseAdminConfigured()) {
      try {
        const adminAuth = getFirebaseAdminAuth();
        const decodedToken = await adminAuth.verifySessionCookie(
          sessionCookie,
          false
        );
        // Revoke active refresh tokens for the user in Firebase
        await adminAuth.revokeRefreshTokens(decodedToken.uid);
      } catch {
        // Continue clearing cookie even if session verification fails
      }
    }

    // Clear the HTTP-only cookie
    cookieStore.set(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
