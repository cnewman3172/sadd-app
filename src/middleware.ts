import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const roleHome: Record<string, string> = {
  ADMIN: '/executives',
  COORDINATOR: '/dashboard',
  TC: '/driving',
  RIDER: '/request',
};

export async function middleware(req: NextRequest) {
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

  // Fetch live role from API to avoid stale JWT claims after role changes
  let liveRole: string | null = null;
  try{
    const res = await fetch(new URL('/api/me', req.url), {
      headers: { cookie: req.headers.get('cookie') || '' },
    });
    if (!res.ok) return NextResponse.redirect(new URL('/login', req.url));
    const u = await res.json();
    liveRole = u?.role || null;
  }catch{
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const route = protectedRoutes.find((r) => pathname.startsWith(r.path));
  if (route && (!liveRole || !route.roles.includes(liveRole))) return NextResponse.redirect(new URL('/', req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/executives/:path*', '/dashboard/:path*', '/driving/:path*', '/request/:path*', '/profile/:path*'],
};
