import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }){
  const ride = await prisma.ride.findUnique({ where: { id: params.id }, include: { rider: true, van: true } });
  if (!ride) return NextResponse.json({ error:'not found' }, { status: 404 });
  return NextResponse.json(ride);
}

export async function PUT(req: Request, { params }: { params: { id: string } }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = verifyToken(token);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'COORDINATOR' && payload.role !== 'TC')) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { status, vanId, driverId, coordinatorId, notes } = await req.json();
  const ride = await prisma.ride.update({ where: { id: params.id }, data: {
    status, vanId, driverId, coordinatorId, notes
  }});
  return NextResponse.json(ride);
}
