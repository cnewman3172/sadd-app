import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','DISPATCHER'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { id } = await context.params;
  // Return tasks in planned order (VanTask)
  const plan = await prisma.vanTask.findMany({ where:{ vanId: id }, orderBy:{ order:'asc' }, include:{ ride:true } });
  const tasks = plan.map(p=> ({ id: p.rideId, status: p.ride.status, pickupLat: p.ride.pickupLat, pickupLng: p.ride.pickupLng, dropLat: p.ride.dropLat, dropLng: p.ride.dropLng, phase: p.phase }));
  return NextResponse.json({ tasks });
}
