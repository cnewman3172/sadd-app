import { NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { captureError } from '@/lib/obs';
import { prisma } from '@/lib/prisma';
import { publish } from '@/lib/events';
import { logAudit } from '@/lib/audit';

const schema = z.object({
  pickupAddr: z.string().min(1).optional(),
  dropAddr: z.string().min(1).optional(),
  passengers: z.number().int().min(1).max(8).optional(),
  notes: z.string().max(500).optional(),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  dropLat: z.number().optional(),
  dropLng: z.number().optional(),
});

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload) return NextResponse.json({ error:'auth required' }, { status: 401 });
  try{
    const { pickupAddr, dropAddr, passengers=1, notes, pickupLat, pickupLng, dropLat, dropLng } = schema.parse(await req.json());
    // naive: if coords missing, leave zeros and let dispatcher edit later
    const ride = await prisma.ride.create({ data: {
      riderId: payload.uid,
      pickupAddr: pickupAddr || 'Unknown',
      dropAddr: dropAddr || 'Unknown',
      pickupLat: pickupLat ?? 0,
      pickupLng: pickupLng ?? 0,
      dropLat: dropLat ?? 0,
      dropLng: dropLng ?? 0,
      passengers: Number(passengers) || 1,
      notes,
    }});
    publish('ride:update', { id: ride.id, status: ride.status, code: ride.rideCode });
    // Auto-assign best van
    try{
      const origin = new URL(req.url).origin;
      const s = await fetch(`${origin}/api/assign/suggest?rideId=${ride.id}`).then(r=>r.json());
      const best = s.ranked?.[0];
      if (best?.vanId){
        const updated = await prisma.ride.update({ where: { id: ride.id }, data: { status:'ASSIGNED', vanId: best.vanId, acceptedAt: new Date() } });
        publish('ride:update', { id: updated.id, status: updated.status, code: updated.rideCode, vanId: updated.vanId });
        logAudit('ride_auto_assign', payload.uid, updated.id, { vanId: best.vanId });
      }
    }catch{}
    logAudit('ride_create', payload.uid, ride.id, { pickupAddr, dropAddr, passengers });
    return NextResponse.json(ride);
  }catch(e:any){
    captureError(e, { route: 'rides/request', uid: payload.uid });
    return NextResponse.json({ error: e?.message || 'Request failed' }, { status: 400 });
  }
}
