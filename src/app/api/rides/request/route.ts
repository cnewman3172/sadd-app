import { NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { publish } from '@/lib/events';
import { logAudit } from '@/lib/audit';

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload) return NextResponse.json({ error:'auth required' }, { status: 401 });
  const { pickupAddr, dropAddr, passengers=1, notes, pickupLat, pickupLng, dropLat, dropLng } = await req.json();
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
  logAudit('ride_create', payload.uid, ride.id, { pickupAddr, dropAddr, passengers });
  return NextResponse.json(ride);
}
