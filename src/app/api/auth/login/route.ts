import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(req: Request){
  const body = schema.parse(await req.json());
  const res = await authenticate(body.email, body.password);
  if (!res) return NextResponse.json({ error:'Invalid credentials' }, { status: 401 });
  const r = NextResponse.json({ ok: true, role: res.user.role });
  const secure = (process.env.NEXT_PUBLIC_APP_URL||'').startsWith('https') || process.env.NODE_ENV === 'production';
  r.cookies.set('sadd_token', res.token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60*60*24*7, secure });
  // redirect-on-first-login page decided on client after login; server leaves cookie only
  return r;
}

export async function GET(){
  return NextResponse.json({ ok: true });
}
