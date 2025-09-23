import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const roleHome: Record<string, string> = {
  ADMIN: '/executives',
  DISPATCHER: '/dashboard',
  TC: '/driving',
  DRIVER: '/shifts',
  SAFETY: '/shifts',
  RIDER: '/request',
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const protectedRoutes: Array<{ path: string; roles: string[] }> = [
    { path: '/executives', roles: ['ADMIN'] },
    { path: '/dashboard', roles: ['ADMIN', 'DISPATCHER'] },
    { path: '/driving', roles: ['ADMIN', 'DISPATCHER', 'TC'] },
    { path: '/shifts', roles: ['ADMIN', 'DISPATCHER', 'TC', 'DRIVER', 'SAFETY'] },
    { path: '/request', roles: ['ADMIN', 'DISPATCHER', 'TC', 'DRIVER', 'SAFETY', 'RIDER'] },
    { path: '/profile', roles: ['ADMIN', 'DISPATCHER', 'TC', 'DRIVER', 'SAFETY', 'RIDER'] },
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

  // If claim allows access, later we may still gate by active shift for certain portals
  if (claimRole && route.roles.includes(claimRole)){
    // Extra gate: time-based portal access for Dispatcher and TC views
    const isPortal = pathname.startsWith('/dashboard') || pathname.startsWith('/driving');
    if (!isPortal) return NextResponse.next();

    // Admin bypasses schedule
    if (claimRole === 'ADMIN') return NextResponse.next();

    const neededRole = pathname.startsWith('/dashboard') ? 'DISPATCHER' : 'TC';
    // Verify the user has an active shift for the needed role (Dispatchers can access TC if they signed up)
    try{
      const res = await fetch(new URL(`/api/shifts/active?role=${neededRole}`, req.url), { headers: { cookie: req.headers.get('cookie') || '' } });
      if (res.ok){
        const d = await res.json();
        if (d?.active) return NextResponse.next();
      }
    }catch{}
    // Not active; redirect to /shifts where they can sign up
    return NextResponse.redirect(new URL('/shifts', req.url));
  }

  // Otherwise, try fetching live role from API to reflect recent admin changes
  try{
    const res = await fetch(new URL('/api/me', req.url), { headers: { cookie: req.headers.get('cookie') || '' } });
    if (res.ok){
      const u = await res.json();
      const liveRole = u?.role || null;
      if (liveRole && route.roles.includes(liveRole)){
        const isPortal = pathname.startsWith('/dashboard') || pathname.startsWith('/driving');
        if (!isPortal) return NextResponse.next();
        if (liveRole === 'ADMIN') return NextResponse.next();
        const neededRole = pathname.startsWith('/dashboard') ? 'DISPATCHER' : 'TC';
        try{
          const res2 = await fetch(new URL(`/api/shifts/active?role=${neededRole}`, req.url), { headers: { cookie: req.headers.get('cookie') || '' } });
          if (res2.ok){ const d2 = await res2.json(); if (d2?.active) return NextResponse.next(); }
        }catch{}
        return NextResponse.redirect(new URL('/shifts', req.url));
      }
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
