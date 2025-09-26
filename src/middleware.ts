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
  // Avoid triggering client-side RSC fetch errors on prefetches.
  // Next.js sends these headers when it is only prefetching.
  const isPrefetch =
    req.headers.get('next-router-prefetch') === '1' ||
    req.headers.get('next-router-segment-prefetch') === '1' ||
    // Safari and some agents use the legacy header
    (req.headers.get('purpose')||'').toLowerCase() === 'prefetch' ||
    (req.headers.get('sec-purpose')||'').toLowerCase() === 'prefetch';
  if (isPrefetch) return NextResponse.next();
  // No-op: auth and role checks moved into pages and APIs.
  return NextResponse.next();
}

export const config = {
  matcher: ['/executives/:path*', '/dashboard/:path*', '/driving/:path*', '/shifts/:path*', '/request/:path*', '/profile/:path*'],
};
