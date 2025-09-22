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
    { path: '/shifts', roles: ['ADMIN', 'COORDINATOR', 'TC'] },
    { path: '/request', roles: ['ADMIN', 'COORDINATOR', 'TC', 'RIDER'] },
    { path: '/profile', roles: ['ADMIN', 'COORDINATOR', 'TC', 'RIDER'] },
  ];

  const saddRoutes = protectedRoutes.map((r) => r.path);
  if (!saddRoutes.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get('sadd_token')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', req.url));

  // First, decode role from JWT claim (fast path)
  let claimRole: string | null = null;
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const json = Buffer.from(b64, 'base64').toString('utf8');
      const payload = JSON.parse(json);
      claimRole = payload?.role ?? null;
    }
  } catch {}

  const route = protectedRoutes.find((r) => pathname.startsWith(r.path));
  if (!route) return NextResponse.next();

  // If claim allows access, proceed
  if (claimRole && route.roles.includes(claimRole)) return NextResponse.next();

  // Otherwise, try fetching live role from API to reflect recent admin changes
  try{
    const res = await fetch(new URL('/api/me', req.url), { headers: { cookie: req.headers.get('cookie') || '' } });
    if (res.ok){
      const u = await res.json();
      const liveRole = u?.role || null;
      if (liveRole && route.roles.includes(liveRole)) return NextResponse.next();
      // Logged in but not authorized for this route
      return NextResponse.redirect(new URL('/', req.url));
    }
  }catch{}

  // Fallback: if token exists but we couldn't verify, send to login once
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/executives/:path*', '/dashboard/:path*', '/driving/:path*', '/shifts/:path*', '/request/:path*', '/profile/:path*'],
};
