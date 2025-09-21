import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','COORDINATOR'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { id } = await context.params;
  const tasks = await prisma.ride.findMany({
    where: { vanId: id, status: { in: ['ASSIGNED','EN_ROUTE','PICKED_UP'] } },
    orderBy: { requestedAt: 'asc' },
    select: { id:true, status:true, pickupLat:true, pickupLng:true, dropLat:true, dropLng:true }
  });
  return NextResponse.json({ tasks });
}

