import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload) return NextResponse.json({ error:'unauthorized' }, { status: 401 });
  try{
    const body = await req.json();
    const sub = body?.subscription || body;
    const endpoint: string = sub?.endpoint;
    const p256dh: string = sub?.keys?.p256dh || sub?.p256dh;
    const auth: string = sub?.keys?.auth || sub?.auth;
    if (!endpoint || !p256dh || !auth) return NextResponse.json({ error:'invalid' }, { status: 400 });
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh, auth, userId: payload.uid },
      create: { endpoint, p256dh, auth, userId: payload.uid },
    });
    return NextResponse.json({ ok:true });
  }catch(e:any){
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 400 });
  }
}

export async function DELETE(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload) return NextResponse.json({ ok:true });
  try{
    const body = await req.json().catch(()=>({}));
    const endpoint: string|undefined = body?.endpoint;
    if (endpoint){ await prisma.pushSubscription.delete({ where: { endpoint } }).catch(()=>{}); }
  }catch{}
  return NextResponse.json({ ok:true });
}

