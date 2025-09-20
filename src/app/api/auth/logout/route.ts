import { NextResponse } from 'next/server';

export async function POST(){
  const r = NextResponse.json({ ok:true });
  const secure = (process.env.NEXT_PUBLIC_APP_URL||'').startsWith('https') || process.env.NODE_ENV === 'production';
  r.cookies.set('sadd_token','', { path:'/', maxAge:0, secure });
  return r;
}
