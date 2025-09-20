import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
  if (!token) return NextResponse.redirect(new URL('/login', req.url));

  // Decode JWT payload on the Edge without Node libraries.
  // Note: This does NOT verify the signature (APIs still enforce real auth).
  let role: string | null = null;
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const json = atob(b64);
      const payload = JSON.parse(json);
      role = payload?.role ?? null;
    }
  } catch {
    role = null;
  }
  if (!role) return NextResponse.redirect(new URL('/login', req.url));

  const route = protectedRoutes.find((r) => pathname.startsWith(r.path));
  if (route && !route.roles.includes(role)) return NextResponse.redirect(new URL('/', req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/executives/:path*', '/dashboard/:path*', '/driving/:path*', '/request/:path*', '/profile/:path*'],
};
