import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { publish } from '@/lib/events';
import { notifyRoles } from '@/lib/push';
import { logAudit } from '@/lib/audit';
import { captureError } from '@/lib/obs';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

// Accept common "empty string" placeholders from clients by coercing
// them to undefined before validation. This avoids failures like
// "Invalid uuid" for riderId: "" and allows pickupAddr: "" when the
// pickup should be inferred from the current task context.
const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const schema = z.object({
  riderId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  name: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  phone: z.preprocess(emptyToUndefined, z.string().min(7).optional()),
  // Allow specifying pickup when not on a task; coerce "" to undefined
  pickupAddr: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  dropAddr: z.string().min(1),
  dropLat: z.number().optional(),
  dropLng: z.number().optional(),
  passengers: z.coerce.number().int().min(1).max(11).default(1),
  taskId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  // Allow staff roles to add walk-ons. The van must still be claimed by
  // the current user (checked below via activeTcId), so this does not
  // broaden access to unclaimed vans.
  if (!payload || !['ADMIN','DISPATCHER','TC'].includes(payload.role)){
    return NextResponse.json({ error:'forbidden' }, { status: 403 });
  }
  try{
    const body = schema.parse(await req.json());

    // Find the van this TC controls
    const van = await prisma.van.findFirst({ where:{ activeTcId: payload.uid } });
    if (!van) return NextResponse.json({ error:'not online with a van' }, { status: 400 });

    const tcUser = await prisma.user.findUnique({ where: { id: payload.uid }, select: { id: true, firstName: true, lastName: true, email: true, phone: true } });

    // Determine current task to source pickup location (optional)
    let task = null as any;
    if (body.taskId){
      task = await prisma.ride.findFirst({ where: { id: body.taskId, vanId: van.id, status: { in: ['ASSIGNED','EN_ROUTE','PICKED_UP'] } } });
    }
    if (!task){
      task = await prisma.ride.findFirst({ where: { vanId: van.id, status: { in: ['ASSIGNED','EN_ROUTE','PICKED_UP'] } }, orderBy: { requestedAt: 'asc' } });
    }
    // If no task context, require explicit pickup address from client
    if (!task && !body.pickupAddr){
      return NextResponse.json({ error:'pickup required when not on a task' }, { status: 400 });
    }

    // Require existing rider account
    let rider = body.riderId ? await prisma.user.findUnique({ where: { id: body.riderId } }) : null;
    if (!rider){
      // Attach to shared unlinked rider
      const email = 'unlinked@sadd.local';
      rider = await prisma.user.findUnique({ where: { email } });
      if (!rider){
        const hash = await bcrypt.hash(Math.random().toString(36).slice(2), 12);
        rider = await prisma.user.create({ data: { email, password: hash, firstName: 'Unlinked', lastName: 'Rider', role: 'RIDER' } });
      }
    }
    // Ensure rider phone matches walk-on entry
    else if (rider.phone !== body.phone){
      try{ await prisma.user.update({ where:{ id: rider.id }, data:{ phone: body.phone } }); }catch{}
    }

    // Create the ride, assign to this van immediately
    // Encode TC-supplied contact info into notes for coordinator visibility
    const meta: Record<string, any> = {};
    if (body.name || body.phone){
      meta.manualContact = { name: body.name, phone: body.phone };
    }
    if (tcUser){
      meta.walkOnTc = {
        id: tcUser.id,
        firstName: tcUser.firstName,
        lastName: tcUser.lastName,
        email: tcUser.email,
        phone: tcUser.phone,
      };
    }
    let notes: string | undefined = undefined;
    if (Object.keys(meta).length){
      try{ notes = JSON.stringify(meta); }catch{}
    }
  let ride = await prisma.ride.create({ data: {
      riderId: rider.id,
      pickupAddr: task?.pickupAddr || body.pickupAddr!,
      dropAddr: body.dropAddr,
      pickupLat: task?.pickupLat ?? (typeof body.pickupLat==='number' ? body.pickupLat : 0),
      pickupLng: task?.pickupLng ?? (typeof body.pickupLng==='number' ? body.pickupLng : 0),
      dropLat: typeof body.dropLat==='number' ? body.dropLat : 0,
      dropLng: typeof body.dropLng==='number' ? body.dropLng : 0,
      passengers: Number(body.passengers) || 1,
      notes: notes || 'WALK_ON',
      source: 'REQUEST',
      status: 'ASSIGNED',
      vanId: van.id,
      driverId: van.activeTcId ?? payload.uid,
      coordinatorId: payload.uid,
      acceptedAt: new Date(),
    }});
    if (!ride.driverId){
      const fallbackDriverId = van.activeTcId ?? payload.uid;
      if (fallbackDriverId){
        try{ ride = await prisma.ride.update({ where: { id: ride.id }, data: { driverId: fallbackDriverId } }); }catch{}
      }
    }
    if (!ride.coordinatorId && payload.uid){
      try{ ride = await prisma.ride.update({ where: { id: ride.id }, data: { coordinatorId: payload.uid } }); }catch{}
    }
  publish('ride:update', { id: ride.id, status: ride.status, code: ride.rideCode, vanId: ride.vanId, riderId: ride.riderId });
  try{ const { rebuildPlanForVan } = await import('@/lib/plan'); await rebuildPlanForVan(van.id); }catch{}
  try{
    const msg = `New walk-on #${ride.rideCode}`;
    await notifyRoles(['DISPATCHER','TC'], { title: msg, body: `${ride.pickupAddr} → ${ride.dropAddr}`, tag: 'ride-walkon', data:{ rideId: ride.id } });
  }catch{}
    await logAudit('ride_create_walkon', payload.uid, ride.id, { vanId: van.id });
    return NextResponse.json(ride);
  }catch(e:any){
    captureError(e, { route: 'driver/walk-on', uid: payload?.uid });
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 400 });
  }
}
