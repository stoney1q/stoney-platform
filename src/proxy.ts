import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth/types';

/**
 * Public routes that bypass authentication.
 * All other routes require a valid session cookie.
 *
 * IMPORTANT: This proxy is a coarse routing boundary ONLY.
 * It performs a cookie-existence check and is NOT the authoritative
 * authorization layer. Server guards are authoritative:
 *   - requireAuth()
 *   - requireRole()
 *   - requirePermission()
 *   - requireBranchAccess()
 *
 * Never perform database RBAC queries or Firebase Admin initialization here.
 */
const PUBLIC_ROUTES: RegExp[] = [
  /^\/login(\/.*)?$/,
  /^\/forgot-password(\/.*)?$/,
  /^\/api\/auth(\/.*)?$/,
];

/**
 * Determines whether the given pathname is a public (unauthenticated) route.
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((pattern) => pattern.test(pathname));
}

/**
 * Builds a safe, open-redirect-proof redirect URL to /login.
 *
 * The `from` parameter is only set when:
 * - The pathname is not already /login
 * - The pathname is a relative path (no protocol, no external host)
 *
 * Client-provided redirect parameters are never trusted.
 */
function buildLoginRedirect(request: NextRequest): URL {
  const loginUrl = new URL('/login', request.url);
  const pathname = request.nextUrl.pathname;

  if (pathname && pathname !== '/' && pathname !== '/login') {
    // Only include the path — never query params or hashes from the original
    // request that could contain sensitive data. The pathname is always
    // relative (starts with /) so there is no open-redirect risk.
    loginUrl.searchParams.set('from', pathname);
  }

  return loginUrl;
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Allow all public routes through without any session check.
  if (isPublicRoute(pathname)) {
    // Authenticated users visiting /login are redirected to home.
    const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME);
    if (sessionCookie?.value && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Protected route — require session cookie presence.
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME);
  if (!sessionCookie?.value) {
    return NextResponse.redirect(buildLoginRedirect(request));
  }

  // Session cookie exists. Allow through to the server layer where the full
  // Firebase Admin + PostgreSQL verification occurs via requireAuth() or
  // getCurrentUser(). This proxy does NOT verify the cookie cryptographically.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (Next.js static assets)
     * - _next/image   (Next.js image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public folder static assets (images, icons, etc.)
     *
     * Note: Even when _next/data is excluded in a negative matcher pattern,
     * proxy still runs for _next/data routes to prevent accidentally leaving
     * data routes unprotected. This is intentional Next.js behavior.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf)$).*)',
  ],
};
