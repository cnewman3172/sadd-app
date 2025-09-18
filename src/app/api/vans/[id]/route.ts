import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function PUT(req: Request, { params }: { params: { id: string } }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = verifyToken(token);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'COORDINATOR' && payload.role !== 'TC')) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { status, capacity, passengers, activeTcId, name } = await req.json();
  const van = await prisma.van.update({ where: { id: params.id }, data: { 
    status, 
    capacity, 
    passengers, 
    activeTcId, 
    name,
  }});
  return NextResponse.json(van);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = verifyToken(token);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'COORDINATOR')) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  await prisma.van.delete({ where: { id: params.id } });
  return NextResponse.json({ ok:true });
}
