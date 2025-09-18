import { NextResponse } from 'next/server';
import { authenticate, verifyToken } from '@/lib/auth';

export async function POST(req: Request){
  const body = await req.json();
  const { email, password } = body;
  const res = await authenticate(email, password);
  if (!res) return NextResponse.json({ error:'Invalid credentials' }, { status: 401 });
  const r = NextResponse.json({ ok: true, role: res.user.role });
  r.cookies.set('sadd_token', res.token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60*60*24*7 });
  // redirect-on-first-login page decided on client after login; server leaves cookie only
  return r;
}

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ authenticated:false });
  return NextResponse.json({ authenticated:true, payload });
}
