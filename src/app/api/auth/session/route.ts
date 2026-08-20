import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getFirebaseAdminAuth,
  isFirebaseAdminConfigured,
} from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/guard';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE } from '@/lib/auth/types';
import prisma from '@/lib/prisma';

/**
 * POST /api/auth/session
 * Exchanging a verified Firebase ID token for an HTTP-only session cookie.
 */
export async function POST(request: Request) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      { error: 'Firebase Admin credentials are not configured on the server.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const idToken = body?.idToken;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: "idToken" string is required.' },
        { status: 400 }
      );
    }

    const adminAuth = getFirebaseAdminAuth();
    // 1. Verify the client-provided Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const tokenEmail = decodedToken.email;

    // 2. Verify or link user in PostgreSQL
    let dbUser = await prisma.user.findUnique({
      where: { firebaseUid },
    });

    if (!dbUser && tokenEmail) {
      const userByEmail = await prisma.user.findUnique({
        where: { email: tokenEmail },
      });

      if (userByEmail && !userByEmail.firebaseUid) {
        dbUser = await prisma.user.update({
          where: { id: userByEmail.id },
          data: {
            firebaseUid,
            emailVerified: Boolean(decodedToken.email_verified),
          },
        });
      }
    }

    if (!dbUser) {
      return NextResponse.json(
        {
          error:
            'Identity verified, but account has not been provisioned in Stoney Platform. Please contact an administrator.',
          code: 'NOT_PROVISIONED',
        },
        { status: 403 }
      );
    }

    if (!dbUser.isActive) {
      return NextResponse.json(
        {
          error:
            'Your account has been deactivated. Please contact an administrator.',
          code: 'INACTIVE_USER',
        },
        { status: 403 }
      );
    }

    // 3. Create a secure session cookie via Firebase Admin
    const expiresIn = AUTH_COOKIE_MAX_AGE * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });

    // 4. Set the HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: AUTH_COOKIE_MAX_AGE,
    });

    // 5. Resolve full user context
    const user = await getCurrentUser(sessionCookie);

    return NextResponse.json({
      ok: true,
      user,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Session exchange failed';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

/**
 * GET /api/auth/session
 * Returns the currently authenticated user's profile and RBAC permissions.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user,
  });
}

/**
 * DELETE /api/auth/session
 * Clears the session cookie.
 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  return NextResponse.json({ ok: true });
}
