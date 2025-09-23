import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { publish } from '@/lib/events';
import { allowPing } from '@/lib/ratelimit';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({ lat: z.number(), lng: z.number() });

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','DISPATCHER','TC'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { lat, lng } = schema.parse(await req.json());
  if (!allowPing(payload.uid)) return NextResponse.json({ ok:false, rate_limited:true }, { status: 429 });
  const van = await prisma.van.findFirst({ where:{ activeTcId: payload.uid } });
  if (!van) return NextResponse.json({ ok:true });
  await prisma.van.update({ where:{ id: van.id }, data:{ currentLat: lat, currentLng: lng, lastPing: new Date(), status: 'ACTIVE' } });
  publish('vans:location', { id: van.id, lat, lng });
  return NextResponse.json({ ok:true });
}
