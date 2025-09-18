import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

const roleHome: Record<string, string> = {
  ADMIN: '/executives',
  COORDINATOR: '/dashboard',
  TC: '/driving',
  RIDER: '/request',
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const protectedRoutes: Array<{ path: string; roles: string[] }> = [
    { path: '/executives', roles: ['ADMIN'] },
    { path: '/dashboard', roles: ['ADMIN', 'COORDINATOR'] },
    { path: '/driving', roles: ['ADMIN', 'COORDINATOR', 'TC'] },
    { path: '/request', roles: ['ADMIN', 'COORDINATOR', 'TC', 'RIDER'] },
    { path: '/profile', roles: ['ADMIN', 'COORDINATOR', 'TC', 'RIDER'] },
  ];

  const saddRoutes = protectedRoutes.map((r) => r.path);
  if (!saddRoutes.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get('sadd_token')?.value;
  const payload = verifyToken(token);
  if (!payload) return NextResponse.redirect(new URL('/login', req.url));

  const route = protectedRoutes.find((r) => pathname.startsWith(r.path));
  if (!route) return NextResponse.next();
  if (!route.roles.includes(payload.role)) return NextResponse.redirect(new URL('/', req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/executives/:path*', '/dashboard/:path*', '/driving/:path*', '/request/:path*', '/profile/:path*'],
};

