import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { publish } from '@/lib/events';
import { logAudit } from '@/lib/audit';

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
  let data: any = { status, vanId, driverId, coordinatorId, notes };
  if (vanId && !driverId){
    const van = await prisma.van.findUnique({ where: { id: vanId } });
    if (van?.activeTcId){
      data.driverId = van.activeTcId;
    }
  }
  const ride = await prisma.ride.update({ where: { id: params.id }, data });
  publish('ride:update', { id: ride.id, status: ride.status, code: ride.rideCode, vanId: ride.vanId });
  logAudit('ride_update', payload.uid, ride.id, data);
  return NextResponse.json(ride);
}
