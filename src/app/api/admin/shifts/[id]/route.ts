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
  const schema = z.object({ title: z.string().max(120).optional(), startsAt: z.string().datetime().optional(), endsAt: z.string().datetime().optional(), needed: z.coerce.number().int().min(1).max(10).optional(), notes: z.string().max(500).optional(), role: z.enum(['COORDINATOR','TC']).optional() });
  try{
    const patch = schema.parse(await req.json());
    // Fetch current to support overnight logic if only one bound provided
    const current = await prisma.shift.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error:'not found' }, { status:404 });
    const start = 'startsAt' in patch ? new Date(patch.startsAt!) : current.startsAt;
    let end = 'endsAt' in patch ? new Date(patch.endsAt!) : current.endsAt;
    if (end <= start) end = new Date(end.getTime() + 24*60*60*1000);
    const s = await prisma.shift.update({ where: { id }, data: {
      ...('title' in patch ? { title: patch.title } : {}),
      ...('role' in patch ? { role: patch.role as any } : {}),
      startsAt: start,
      endsAt: end,
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
