import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'COORDINATOR' && payload.role !== 'TC')) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || undefined;
  const take = Number(url.searchParams.get('take')||'50');
  const rides = await prisma.ride.findMany({
    where: { status: status as any },
    orderBy: { requestedAt: 'desc' },
    take,
    include: { rider: true, van: true },
  });
  return NextResponse.json(rides);
}
