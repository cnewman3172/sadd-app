import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { id } = await ctx.params;
  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift) return NextResponse.json({ error:'not found' }, { status: 404 });
  const signups = await prisma.shiftSignup.findMany({
    where: { shiftId: id },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: {
      id: true, email: true, firstName: true, lastName: true, phone: true, role: true,
      trainingSafetyAt: true, trainingDriverAt: true, trainingTcAt: true, trainingDispatcherAt: true,
      checkRide: true,
    } } }
  });
  const users = signups.map(s=> s.user);
  return NextResponse.json({ shift: { id: shift.id, title: shift.title, role: shift.role, startsAt: shift.startsAt, endsAt: shift.endsAt, needed: shift.needed }, users });
}

