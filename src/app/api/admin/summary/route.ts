import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { captureError } from '@/lib/obs';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  try{
    const [totalUsers, totalRides, activeRides, ridesToday, activeVans, setting] = await Promise.all([
      prisma.user.count(),
      prisma.ride.count(),
      prisma.ride.count({ where: { status: { in: ['ASSIGNED','EN_ROUTE','PICKED_UP'] } } }),
      prisma.ride.count({ where: { requestedAt: { gte: new Date(new Date().toDateString()) } } }),
      prisma.van.count({ where: { status: 'ACTIVE' } }),
      prisma.setting.findUnique({ where: { id: 1 } })
    ]);
    const lastRides = await prisma.ride.findMany({
      orderBy: { requestedAt: 'desc' },
      take: 10,
      include: { rider: true, van: true }
    });
    return NextResponse.json({
      totalUsers, totalRides, activeRides, ridesToday, activeVans, active: setting?.active ?? false,
      lastRides
    });
  }catch(e:any){
    captureError(e, { route: 'admin/summary', uid: payload.uid });
    return NextResponse.json({ error:'failed' }, { status: 500 });
  }
}

