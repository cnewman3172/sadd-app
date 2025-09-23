import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','DISPATCHER','TC','DRIVER','SAFETY'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });

  // Determine which shift roles this user may view/signup for
  // - ADMIN: all roles
  // - COORDINATOR: COORDINATOR and roles below (TC)
  // - TC: only TC
  const allowedRoles = payload.role === 'ADMIN'
    ? ['DISPATCHER','TC','DRIVER','SAFETY']
    : payload.role === 'DISPATCHER'
      ? ['DISPATCHER','TC','DRIVER','SAFETY']
      : payload.role === 'TC'
        ? ['TC','DRIVER','SAFETY']
        : payload.role === 'DRIVER'
          ? ['DRIVER']
          : payload.role === 'SAFETY'
            ? ['SAFETY']
            : [];

  const from = new Date();
  const shifts = await prisma.shift.findMany({
    where: { endsAt: { gte: from }, role: { in: allowedRoles as any } },
    orderBy: { startsAt: 'asc' },
    include: { signups: { select: { userId: true } } },
    take: 200,
  });
  const items = shifts.map(s=> ({
    ...s,
    signupCount: s.signups.length,
    isSigned: s.signups.some(x=> x.userId === payload.uid),
    signups: undefined,
  }));
  return NextResponse.json(items);
}
