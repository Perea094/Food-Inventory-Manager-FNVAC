import { NextResponse } from 'next/server.js';
import type { NextRequest } from 'next/server.js';
import { verifySessionToken, SESSION_COOKIE_NAME } from './lib/session.ts';

export type SessionUser = {
  role: string;
  userId?: string;
  username?: string;
  name?: string;
};

export type AccessDecision =
  | { allowed: true }
  | { redirect: string }
  | { status: number; error?: string };

/**
 * Pure evaluation function for route access control and perimeter protection.
 */
export function evaluateAccess(
  pathname: string,
  session: SessionUser | null
): AccessDecision {
  // 1. Static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/logo') ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$/.test(pathname)
  ) {
    return { allowed: true };
  }

  // 2. Public auth endpoints
  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
    return { allowed: true };
  }

  // 3. /recepcion always redirects to /operador regardless of session or role
  if (pathname === '/recepcion' || pathname.startsWith('/recepcion/')) {
    return { redirect: '/operador' };
  }

  // 4. /login endpoint handling
  if (pathname === '/login') {
    if (session) {
      return { redirect: session.role === 'admin' ? '/' : '/operador' };
    }
    return { allowed: true };
  }

  // 5. Unauthenticated requests
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return { status: 401 };
    }
    return { redirect: '/login' };
  }

  // 6. Operator containment rules
  if (session.role === 'operator') {
    if (
      pathname === '/operador' ||
      pathname.startsWith('/operador/') ||
      pathname === '/api/inventory' ||
      pathname.startsWith('/api/inventory/') ||
      pathname === '/api/products' ||
      pathname.startsWith('/api/products/')
    ) {
      return { allowed: true };
    }
    return { redirect: '/operador' };
  }

  // 7. Admin privileges
  if (session.role === 'admin') {
    return { allowed: true };
  }

  // 8. Default fallback for unknown roles
  return { redirect: '/login' };
}

/**
 * Next.js Edge/Perimeter Middleware
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  const pathname = request.nextUrl.pathname;

  const decision = evaluateAccess(pathname, session);

  if ('status' in decision) {
    return NextResponse.json(
      { error: decision.error || 'Unauthorized' },
      { status: decision.status }
    );
  }

  if ('redirect' in decision) {
    return NextResponse.redirect(new URL(decision.redirect, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
