import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { captureError } from '@/lib/obs';
import { isMissingTableError } from '@/lib/prismaErrors';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, context: { params: { id: string } }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','DISPATCHER'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  try{
    const idParam = context.params?.id || '';
    const parsed = z.string().uuid().safeParse(idParam);
    if (!parsed.success){
      return NextResponse.json({ error:'bad id' }, { status: 400 });
    }
    const id = parsed.data;
    // Return tasks in planned order (VanTask)
    let plan: Awaited<ReturnType<typeof prisma.vanTask.findMany>>;
    try{
      plan = await prisma.vanTask.findMany({ where:{ vanId: id }, orderBy:{ order:'asc' }, include:{ ride:true } });
    }catch(err){
      if (isMissingTableError(err)){
        return NextResponse.json({ tasks: [] });
      }
      throw err;
    }
    const tasks = plan.map(p=> ({ id: p.rideId, status: p.ride.status, pickupLat: p.ride.pickupLat, pickupLng: p.ride.pickupLng, dropLat: p.ride.dropLat, dropLng: p.ride.dropLng, phase: p.phase }));
    return NextResponse.json({ tasks });
  }catch(e:any){
    captureError(e, { route: 'vans/[id]/tasks', id: (context as any)?.params?.id, uid: payload?.uid });
    return NextResponse.json({ error:'failed' }, { status: 500 });
  }
}
