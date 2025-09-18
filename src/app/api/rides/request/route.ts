import { NextResponse } from 'next/server';
import { verifyToken } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = verifyToken(token);
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
  return NextResponse.json(ride);
}

