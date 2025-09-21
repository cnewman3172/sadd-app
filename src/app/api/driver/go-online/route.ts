import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { publish } from '@/lib/events';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','COORDINATOR','TC'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const body = await req.json().catch(()=>({}));
  const { vanId, lat, lng } = body || {};
  if (!vanId) return NextResponse.json({ error:'vanId required' }, { status: 400 });
  if (typeof lat !== 'number' || typeof lng !== 'number'){
    return NextResponse.json({ error:'location required' }, { status: 400 });
  }

  // Ensure only one TC per van.
  // First, check if the target van is already controlled by another TC.
  const existing = await prisma.van.findUnique({ where:{ id: vanId } });
  if (!existing) return NextResponse.json({ error:'van not found' }, { status: 404 });
  if (existing.activeTcId && existing.activeTcId !== payload.uid){
    return NextResponse.json({ error:'van already has an active TC' }, { status: 409 });
  }
  // Clear any other van the current TC might be attached to
  await prisma.van.updateMany({ where:{ activeTcId: payload.uid }, data:{ activeTcId: null, status: 'OFFLINE', passengers: 0 } });
  // Attempt to claim this van atomically; if someone else grabbed it, fail gracefully
  const result = await prisma.van.updateMany({
    where: { id: vanId, OR: [ { activeTcId: null }, { activeTcId: payload.uid } ] },
    data: { activeTcId: payload.uid, status: 'ACTIVE', currentLat: lat, currentLng: lng, lastPing: new Date() },
  });
  if (result.count === 0){
    return NextResponse.json({ error:'van already has an active TC' }, { status: 409 });
  }
  const van = await prisma.van.findUnique({ where: { id: vanId } });
  publish('vans:update', { id: van.id });
  logAudit('driver_online', payload.uid, van.id);
  return NextResponse.json(van);
}
