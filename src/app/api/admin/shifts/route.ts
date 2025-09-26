import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  // Include shifts that ended within the last 14 days, plus future
  const from = new Date(Date.now() - 14*24*60*60*1000);
  const shifts = await prisma.shift.findMany({
    where: { endsAt: { gte: from } },
    orderBy: { startsAt: 'asc' },
    include: { _count: { select: { signups: true } } },
    take: 200,
  });
  return NextResponse.json(shifts);
}

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const schema = z.object({
    title: z.string().max(120).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    needed: z.coerce.number().int().min(1).max(10).default(1),
    notes: z.string().max(500).optional(),
    role: z.enum(['DISPATCHER','TC','DRIVER','SAFETY']).default('DISPATCHER'),
  });
  try{
    const body = schema.parse(await req.json());
    const start = new Date(body.startsAt);
    let end = new Date(body.endsAt);
    // Support overnight shifts (end before or equal start means next day)
    if (end <= start) end = new Date(end.getTime() + 24*60*60*1000);
    const shift = await prisma.shift.create({ data: {
      title: body.title, role: body.role as any, startsAt: start, endsAt: end, needed: body.needed, notes: body.notes,
    }});
    return NextResponse.json(shift);
  }catch(e:any){
    return NextResponse.json({ error: e?.message || 'invalid' }, { status: 400 });
  }
}
