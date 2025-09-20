import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({ status: z.enum(['PENDING','ASSIGNED','EN_ROUTE','PICKED_UP','DROPPED','CANCELED']).optional(), take: z.coerce.number().int().min(1).max(200).default(50) });

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'COORDINATOR' && payload.role !== 'TC')) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const { status, take } = schema.parse({ status: url.searchParams.get('status') || undefined, take: url.searchParams.get('take') || undefined });
  const rides = await prisma.ride.findMany({
    where: { status: status as any },
    orderBy: { requestedAt: 'desc' },
    take,
    include: { rider: true, van: true },
  });
  return NextResponse.json(rides);
}
