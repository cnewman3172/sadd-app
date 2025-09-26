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
  // Always verify session via API to prevent trusting unsigned JWT claims
  const route = protectedRoutes.find((r) => pathname.startsWith(r.path));
  if (!route) return NextResponse.next();

  try{
    const res = await fetch(new URL('/api/me', req.url), { headers: { cookie: req.headers.get('cookie') || '' } });
    if (!res.ok) return NextResponse.redirect(new URL('/login', req.url));
    const u = await res.json();
    const liveRole = u?.role || null;
    if (!liveRole || !route.roles.includes(liveRole)){
      return NextResponse.redirect(new URL('/', req.url));
    }

    // Training gate for Shifts: require training completion per role
    if (pathname.startsWith('/shifts') && liveRole !== 'ADMIN'){
      const ok = (()=>{
        switch (liveRole){
          case 'DISPATCHER': return Boolean(u.trainingDispatcherAt);
          case 'TC': return Boolean(u.trainingTcAt);
          case 'DRIVER': return Boolean(u.trainingDriverAt) && Boolean(u.checkRide);
          case 'SAFETY': return Boolean(u.trainingSafetyAt);
          default: return true;
        }
      })();
      if (!ok) return NextResponse.redirect(new URL('/training', req.url));
    }

    // Extra gate: time-based portal access for Dispatcher and TC views
    const isPortal = pathname.startsWith('/dashboard') || pathname.startsWith('/driving');
    if (!isPortal) return NextResponse.next();
    if (liveRole === 'ADMIN') return NextResponse.next();

    const neededRole = pathname.startsWith('/dashboard') ? 'DISPATCHER' : 'TC';
    try{
      const res2 = await fetch(new URL(`/api/shifts/active?role=${neededRole}`, req.url), { headers: { cookie: req.headers.get('cookie') || '' } });
      if (res2.ok){ const d2 = await res2.json(); if (d2?.active) return NextResponse.next(); }
    }catch{}
    return NextResponse.redirect(new URL('/shifts', req.url));
  }catch{}

  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/executives/:path*', '/dashboard/:path*', '/driving/:path*', '/shifts/:path*', '/request/:path*', '/profile/:path*'],
};
