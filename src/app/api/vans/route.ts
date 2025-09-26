import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { captureError } from '@/lib/obs';
import { publish } from '@/lib/events';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload) return NextResponse.json({ error:'unauthorized' }, { status: 401 });
  // Only ADMIN/DISPATCHER/TC see full van objects including coordinates and activeTcId
  if (['ADMIN','DISPATCHER','TC'].includes(payload.role)){
    const vans = await prisma.van.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json(vans);
  }
  // Other roles see a sanitized list without live coordinates or controller identity
  const vans = await prisma.van.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, capacity: true, status: true }
  });
  return NextResponse.json(vans);
}

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'DISPATCHER')) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const schema = z.object({ name: z.string().min(1), capacity: z.coerce.number().int().min(1).max(16).default(8) });
  try{
    const { name, capacity } = schema.parse(await req.json());
    const van = await prisma.van.create({ data: { name, capacity } });
    publish('vans:update', { id: van.id });
    logAudit('van_create', payload.uid, van.id, { name, capacity });
    return NextResponse.json(van);
  }catch(e:any){
    captureError(e, { route: 'vans/create', uid: payload.uid });
    return NextResponse.json({ error: e?.message || 'Create failed' }, { status: 400 });
  }
}
