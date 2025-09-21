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
  const { vanId } = await req.json();
  if (!vanId) return NextResponse.json({ error:'vanId required' }, { status: 400 });

  // Ensure only one TC per van.
  // First, check if the target van is already controlled by another TC.
  const existing = await prisma.van.findUnique({ where:{ id: vanId } });
  if (!existing) return NextResponse.json({ error:'van not found' }, { status: 404 });
  if (existing.activeTcId && existing.activeTcId !== payload.uid){
    return NextResponse.json({ error:'van already has an active TC' }, { status: 409 });
  }
  // Clear any other van the current TC might be attached to
  await prisma.van.updateMany({ where:{ activeTcId: payload.uid }, data:{ activeTcId: null, status: 'OFFLINE', passengers: 0 } });
  const van = await prisma.van.update({ where:{ id: vanId }, data:{ activeTcId: payload.uid, status: 'ACTIVE' } });
  publish('vans:update', { id: van.id });
  logAudit('driver_online', payload.uid, van.id);
  return NextResponse.json(van);
}
