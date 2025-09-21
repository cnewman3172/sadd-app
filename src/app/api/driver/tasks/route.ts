import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','COORDINATOR','TC'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });

  // Find van assigned to this TC
  const van = await prisma.van.findFirst({ where:{ activeTcId: payload.uid } });
  if (!van) return NextResponse.json({ van: null, tasks: [] });
  const tasks = await prisma.ride.findMany({
    where: { vanId: van.id, status: { in: ['ASSIGNED','EN_ROUTE','PICKED_UP'] } },
    orderBy: { requestedAt: 'asc' },
    include: { rider: { select: { firstName: true, lastName: true, phone: true, email: true } } },
  });
  return NextResponse.json({ van, tasks });
}
