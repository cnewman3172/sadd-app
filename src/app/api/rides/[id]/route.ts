import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { captureError } from '@/lib/obs';
import { publish } from '@/lib/events';
import { notifyOnShift } from '@/lib/push';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload) return NextResponse.json({ error:'unauthorized' }, { status: 401 });
  const { id } = await context.params;
  try{
    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride) return NextResponse.json({ error:'not found' }, { status: 404 });

    // Role-based access
    if (['ADMIN','DISPATCHER','TC'].includes(payload.role)){
      const full = await prisma.ride.findUnique({ where: { id }, include: { rider: true, van: true } });
      return NextResponse.json(full);
    }
    // Rider can view only their own ride, with limited fields
    if (payload.role === 'RIDER' || payload.role === 'DRIVER' || payload.role === 'SAFETY'){
      if (ride.riderId !== payload.uid) return NextResponse.json({ error:'forbidden' }, { status: 403 });
      const safe = await prisma.ride.findUnique({
        where: { id },
        select: {
          id: true,
          rideCode: true,
          status: true,
          pickupAddr: true,
          dropAddr: true,
          pickupLat: true,
          pickupLng: true,
          dropLat: true,
          dropLng: true,
          passengers: true,
          notes: true,
          requestedAt: true,
          acceptedAt: true,
          pickupAt: true,
          dropAt: true,
          vanId: true,
          rating: true,
          reviewComment: true,
          reviewBypass: true,
          reviewAt: true,
        }
      });
      return NextResponse.json(safe);
    }
    return NextResponse.json({ error:'forbidden' }, { status: 403 });
  }catch(e:any){
    captureError(e, { route: 'rides/[id]#GET', id, uid: payload?.uid });
    return NextResponse.json({ error:'failed' }, { status: 500 });
  }
}

const schema = z.object({
  status: z.enum(['PENDING','ASSIGNED','EN_ROUTE','PICKED_UP','DROPPED','CANCELED']).optional(),
  vanId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  coordinatorId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
});

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'DISPATCHER' && payload.role !== 'TC')) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { status, vanId, driverId, coordinatorId, notes } = schema.parse(await req.json());
  const { id } = await context.params;
  let data: any = { status, vanId, driverId, coordinatorId, notes };
  const prev = await prisma.ride.findUnique({ where: { id } });
  if (prev && status && status !== prev.status){
    const now = new Date();
    if (status === 'ASSIGNED' && !prev.acceptedAt){ data.acceptedAt = now; }
    if (status === 'PICKED_UP' && !prev.pickupAt){ data.pickupAt = now; }
    if (status === 'DROPPED' && !prev.dropAt){ data.dropAt = now; }
  }
  if (vanId && !driverId){
    const van = await prisma.van.findUnique({ where: { id: vanId } });
    if (van?.activeTcId){
      data.driverId = van.activeTcId;
    }
  }
  try{
  const prev = await prisma.ride.findUnique({ where: { id } });
  const ride = await prisma.ride.update({ where: { id }, data });
  publish('ride:update', { id: ride.id, status: ride.status, code: ride.rideCode, vanId: ride.vanId });
  try{
    // Notify on assignment events
    const assignedNow = (!prev?.vanId && !!ride.vanId) || (prev?.status!=='ASSIGNED' && ride.status==='ASSIGNED');
    if (assignedNow){
      const msg = `Assigned #${ride.rideCode}`;
      await Promise.all([
        notifyOnShift('DISPATCHER', { title: msg, body: `${ride.pickupAddr} → ${ride.dropAddr}`, tag: 'ride-assigned', data:{ rideId: ride.id } }),
        notifyOnShift('TC', { title: msg, body: `${ride.pickupAddr} → ${ride.dropAddr}`, tag: 'ride-assigned', data:{ rideId: ride.id } }),
      ]);
    }
  }catch{}
    logAudit('ride_update', payload.uid, ride.id, data);
    return NextResponse.json(ride);
  }catch(e:any){
    captureError(e, { route: 'rides/[id]#PUT', id, uid: payload.uid });
    return NextResponse.json({ error:'update failed' }, { status: 400 });
  }
}
