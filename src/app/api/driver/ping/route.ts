import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { publish } from '@/lib/events';
import { allowPing } from '@/lib/ratelimit';

export const runtime = 'nodejs';

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','COORDINATOR','TC'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { lat, lng } = await req.json();
  if (typeof lat !== 'number' || typeof lng !== 'number') return NextResponse.json({ error:'invalid' }, { status:400 });
  if (!allowPing(payload.uid)) return NextResponse.json({ ok:false, rate_limited:true }, { status: 429 });
  const van = await prisma.van.findFirst({ where:{ activeTcId: payload.uid } });
  if (!van) return NextResponse.json({ ok:true });
  await prisma.van.update({ where:{ id: van.id }, data:{ currentLat: lat, currentLng: lng, lastPing: new Date(), status: 'ACTIVE' } });
  publish('vans:location', { id: van.id, lat, lng });
  return NextResponse.json({ ok:true });
}
