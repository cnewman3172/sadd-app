import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { publish } from '@/lib/events';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'COORDINATOR' && payload.role !== 'TC')) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { status, capacity, passengers, activeTcId, name } = await req.json();
  const { id } = await context.params;
  const van = await prisma.van.update({ where: { id }, data: { 
    status, 
    capacity, 
    passengers, 
    activeTcId, 
    name,
  }});
  publish('vans:update', { id: van.id });
  logAudit('van_update', payload.uid, van.id, { status, capacity, passengers, activeTcId, name });
  return NextResponse.json(van);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'COORDINATOR')) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { id } = await context.params;
  await prisma.van.delete({ where: { id } });
  publish('vans:update', { id, deleted: true });
  logAudit('van_delete', payload.uid, id);
  return NextResponse.json({ ok:true });
}
