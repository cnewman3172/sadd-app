import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt, signJwt } from '@/lib/jwt';

export async function GET(req: Request){
  const cookieHdr = req.headers.get('cookie')||'';
  const token = cookieHdr.split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload) return NextResponse.json({}, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  if (!user) return NextResponse.json({}, { status: 401 });
  const body = { ...user, password: undefined } as any;
  const res = NextResponse.json(body);
  // If role changed since the token was issued, reissue a fresh token
  if (payload.role !== user.role){
    const fresh = await signJwt({ uid: user.id, role: user.role } as any);
    const secure = (process.env.NEXT_PUBLIC_APP_URL||'').startsWith('https') || process.env.NODE_ENV === 'production';
    res.cookies.set('sadd_token', fresh, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60*60*24*7, secure });
  }
  return res;
}

export async function PUT(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload) return NextResponse.json({}, { status: 401 });
  const body = await req.json();
  const { firstName, lastName, rank, unit, phone, checkRide } = body;
  const user = await prisma.user.update({ where: { id: payload.uid }, data: { firstName, lastName, rank, unit, phone, ...(typeof checkRide==='boolean'? { checkRide } : {}) } });
  return NextResponse.json({ ...user, password: undefined });
}
