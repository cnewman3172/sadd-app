import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { publish } from '@/lib/events';
import { logAudit } from '@/lib/audit';
import { captureError } from '@/lib/obs';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  dropAddr: z.string().min(1),
  dropLat: z.number().optional(),
  dropLng: z.number().optional(),
  passengers: z.coerce.number().int().min(1).max(11).default(1),
  taskId: z.string().uuid().optional(),
});

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'TC') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  try{
    const body = schema.parse(await req.json());

    // Find the van this TC controls
    const van = await prisma.van.findFirst({ where:{ activeTcId: payload.uid } });
    if (!van) return NextResponse.json({ error:'not online with a van' }, { status: 400 });

    // Determine current task to source pickup location
    let task = null as any;
    if (body.taskId){
      task = await prisma.ride.findFirst({ where: { id: body.taskId, vanId: van.id, status: { in: ['ASSIGNED','EN_ROUTE','PICKED_UP'] } } });
    }
    if (!task){
      task = await prisma.ride.findFirst({ where: { vanId: van.id, status: { in: ['ASSIGNED','EN_ROUTE','PICKED_UP'] } }, orderBy: { requestedAt: 'asc' } });
    }
    if (!task) return NextResponse.json({ error:'no active task to derive pickup' }, { status: 400 });

    // Find or create rider by phone
    const [firstName, ...rest] = body.name.trim().split(/\s+/);
    const lastName = rest.join(' ');
    let rider = await prisma.user.findFirst({ where: { phone: body.phone } });
    if (!rider){
      const digits = body.phone.replace(/\D/g,'') || `guest${Date.now()}`;
      const emailBase = `${digits}@walkon.sadd.local`;
      const hash = await bcrypt.hash(Math.random().toString(36).slice(2), 10);
      try{
        rider = await prisma.user.create({ data: { email: emailBase, password: hash, firstName: firstName || 'Guest', lastName: lastName || 'WalkOn', phone: body.phone, role: 'RIDER' } });
      }catch{
        rider = await prisma.user.create({ data: { email: `${digits}-${Date.now()}@walkon.sadd.local`, password: hash, firstName: firstName || 'Guest', lastName: lastName || 'WalkOn', phone: body.phone, role: 'RIDER' } });
      }
    }
    // Ensure rider phone matches walk-on entry
    else if (rider.phone !== body.phone){
      try{ await prisma.user.update({ where:{ id: rider.id }, data:{ phone: body.phone } }); }catch{}
    }

    // Create the ride, assign to this van immediately
    const ride = await prisma.ride.create({ data: {
      riderId: rider.id,
      pickupAddr: task.pickupAddr,
      dropAddr: body.dropAddr,
      pickupLat: task.pickupLat ?? 0,
      pickupLng: task.pickupLng ?? 0,
      dropLat: body.dropLat ?? 0,
      dropLng: body.dropLng ?? 0,
      passengers: Number(body.passengers) || 1,
      notes: 'WALK_ON',
      source: 'REQUEST',
      status: 'ASSIGNED',
      vanId: van.id,
      acceptedAt: new Date(),
    }});
    publish('ride:update', { id: ride.id, status: ride.status, code: ride.rideCode, vanId: ride.vanId });
    await logAudit('ride_create_walkon', payload.uid, ride.id, { vanId: van.id });
    return NextResponse.json(ride);
  }catch(e:any){
    captureError(e, { route: 'driver/walk-on', uid: payload?.uid });
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 400 });
  }
}
