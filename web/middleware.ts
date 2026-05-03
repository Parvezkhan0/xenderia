import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const PROTECTED_ROUTES = ['/dashboard'];

// Routes that should redirect to dashboard if already logged in
const AUTH_ROUTES = ['/login', '/signup'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // TODO: Replace this with real Firebase session token check.
  // Example: const token = request.cookies.get('firebase-token')?.value;
  const isAuthenticated = false; // placeholder — always false until Firebase is wired

  // Redirect unauthenticated users away from protected routes
  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Redirect authenticated users away from auth pages
  if (AUTH_ROUTES.includes(pathname)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup'],
};
