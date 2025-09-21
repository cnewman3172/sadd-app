import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id:string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','COORDINATOR'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { id } = await ctx.params;
  const shift = await prisma.shift.findUnique({ where: { id }, include: { _count: { select: { signups: true } } } });
  if (!shift) return NextResponse.json({ error:'not found' }, { status:404 });
  if (shift.endsAt < new Date()) return NextResponse.json({ error:'shift ended' }, { status: 400 });
  if (shift._count.signups >= shift.needed) return NextResponse.json({ error:'shift full' }, { status: 409 });
  try{
    await prisma.shiftSignup.create({ data: { shiftId: id, userId: payload.uid } });
  }catch{}
  return NextResponse.json({ ok:true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id:string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','COORDINATOR'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { id } = await ctx.params;
  await prisma.shiftSignup.deleteMany({ where: { shiftId: id, userId: payload.uid } });
  return NextResponse.json({ ok:true });
}

