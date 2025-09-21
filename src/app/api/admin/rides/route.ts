import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { captureError } from '@/lib/obs';
import { publish } from '@/lib/events';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const schema = z.object({
  riderId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  phone: z.string().min(7).optional(),
  pickupAddr: z.string().min(1),
  dropAddr: z.string().min(1),
  passengers: z.coerce.number().int().min(1).max(11).default(1),
  notes: z.string().max(500).optional(),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  dropLat: z.number().optional(),
  dropLng: z.number().optional(),
});

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','COORDINATOR'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  try{
    const body = schema.parse(await req.json());
    if (!body.riderId){
      return NextResponse.json({ error:'Select an existing rider account (no new accounts are created for manual entries).' }, { status: 400 });
    }
    // Ensure rider phone matches manual entry
    else if (rider.phone !== body.phone){
      try{ await prisma.user.update({ where:{ id: rider.id }, data:{ phone: body.phone } }); }catch{}
    }

    const ride = await prisma.ride.create({ data: {
      riderId: body.riderId,
      pickupAddr: body.pickupAddr,
      dropAddr: body.dropAddr,
      pickupLat: body.pickupLat ?? 0,
      pickupLng: body.pickupLng ?? 0,
      dropLat: body.dropLat ?? 0,
      dropLng: body.dropLng ?? 0,
      passengers: Number(body.passengers) || 1,
      notes: body.notes,
      source: 'REQUEST',
    }});
    publish('ride:update', { id: ride.id, status: ride.status, code: ride.rideCode });
    // Auto-assign best van
    try{
      const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
      const s = await fetch(`${origin}/api/assign/suggest?rideId=${ride.id}`).then(r=>r.json());
      const best = s.ranked?.[0];
      if (best?.vanId){
        const updated = await prisma.ride.update({ where: { id: ride.id }, data: { status:'ASSIGNED', vanId: best.vanId, acceptedAt: new Date() } });
        publish('ride:update', { id: updated.id, status: updated.status, code: updated.rideCode, vanId: updated.vanId });
        await logAudit('ride_auto_assign', payload.uid, updated.id, { vanId: best.vanId });
      }
    }catch{}
    await logAudit('ride_create_manual', payload.uid, ride.id, { riderId: body.riderId });
    return NextResponse.json(ride);
  }catch(e:any){
    captureError(e, { route: 'admin/rides#create', uid: payload?.uid });
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 400 });
  }
}
