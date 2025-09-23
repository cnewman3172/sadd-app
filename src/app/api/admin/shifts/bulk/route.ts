import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';

export const runtime = 'nodejs';

const NeedsSchema = z.object({
  DISPATCHER: z.coerce.number().int().min(0).max(10).default(0),
  TC: z.coerce.number().int().min(0).max(10).default(0),
  DRIVER: z.coerce.number().int().min(0).max(10).default(0),
  SAFETY: z.coerce.number().int().min(0).max(10).default(0),
});

export async function POST(req: Request) {
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });

  const schema = z.object({
    title: z.string().max(120).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    needs: NeedsSchema,
    notes: z.string().max(500).optional(),
  });

  try{
    const body = schema.parse(await req.json());
    const start = new Date(body.startsAt);
    let end = new Date(body.endsAt);
    if (end <= start) end = new Date(end.getTime() + 24*60*60*1000);

    const entries: Array<{ role: 'DISPATCHER'|'TC'|'DRIVER'|'SAFETY'; needed: number }> = [];
    for (const role of ['DISPATCHER','TC','DRIVER','SAFETY'] as const){
      const n = body.needs[role];
      if (n && n > 0) entries.push({ role, needed: n });
    }
    if (entries.length === 0) return NextResponse.json({ error:'no roles selected' }, { status: 400 });

    const created = await prisma.$transaction(entries.map(e=>
      prisma.shift.create({ data: { title: body.title, role: e.role as any, startsAt: start, endsAt: end, needed: e.needed, notes: body.notes } })
    ));
    return NextResponse.json({ ok:true, created });
  }catch(e:any){
    return NextResponse.json({ error: e?.message || 'invalid' }, { status: 400 });
  }
}
