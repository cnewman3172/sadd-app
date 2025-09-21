import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';

export const runtime = 'nodejs';

export async function PUT(req: Request, ctx: { params: Promise<{ id:string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { id } = await ctx.params;
  const schema = z.object({ title: z.string().max(120).optional(), startsAt: z.string().datetime().optional(), endsAt: z.string().datetime().optional(), needed: z.coerce.number().int().min(1).max(10).optional(), notes: z.string().max(500).optional() });
  try{
    const patch = schema.parse(await req.json());
    if (patch.startsAt && patch.endsAt && new Date(patch.endsAt) <= new Date(patch.startsAt)){
      return NextResponse.json({ error:'endsAt must be after startsAt' }, { status: 400 });
    }
    const s = await prisma.shift.update({ where: { id }, data: {
      ...('title' in patch ? { title: patch.title } : {}),
      ...('startsAt' in patch ? { startsAt: new Date(patch.startsAt!) } : {}),
      ...('endsAt' in patch ? { endsAt: new Date(patch.endsAt!) } : {}),
      ...('needed' in patch ? { needed: patch.needed } : {}),
      ...('notes' in patch ? { notes: patch.notes } : {}),
    }});
    return NextResponse.json(s);
  }catch(e:any){ return NextResponse.json({ error: e?.message || 'update_failed' }, { status: 400 }); }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id:string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { id } = await ctx.params;
  await prisma.shift.delete({ where: { id } }).catch(()=>{});
  return NextResponse.json({ ok:true });
}

