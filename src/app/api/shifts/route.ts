import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','DISPATCHER','TC','DRIVER','SAFETY'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });

  // Fetch user to check training gates
  const user = await prisma.user.findUnique({ where: { id: payload.uid }, select: {
    role: true,
    trainingDispatcherAt: true,
    trainingTcAt: true,
    trainingDriverAt: true,
    trainingSafetyAt: true,
    checkRide: true,
  }});
  if (!user) return NextResponse.json({ error:'forbidden' }, { status: 403 });

  function hasTrainingFor(role: 'DISPATCHER'|'TC'|'DRIVER'|'SAFETY'){
    switch(role){
      case 'DISPATCHER': return !!user.trainingDispatcherAt;
      case 'TC': return !!user.trainingTcAt;
      case 'DRIVER': return !!user.trainingDriverAt && !!user.checkRide;
      case 'SAFETY': return !!user.trainingSafetyAt;
    }
  }

  // Determine which shift roles this user may view/signup for
  // - ADMIN: all roles
  // - COORDINATOR: COORDINATOR and roles below (TC)
  // - TC: only TC
  const baseRoles = payload.role === 'ADMIN'
    ? ['DISPATCHER','TC','DRIVER','SAFETY']
    : payload.role === 'DISPATCHER'
      ? ['DISPATCHER','TC','DRIVER','SAFETY']
      : payload.role === 'TC'
        ? ['TC','DRIVER','SAFETY']
        : payload.role === 'DRIVER'
          ? ['DRIVER','SAFETY']
          : payload.role === 'SAFETY'
            ? ['SAFETY']
            : [];
  const allowedRoles = payload.role === 'ADMIN' ? baseRoles : (baseRoles as any[]).filter((r)=> hasTrainingFor(r as any));

  // Volunteers see shifts up to 1 day in the past (recent) and future
  const from = new Date(Date.now() - 1*24*60*60*1000);
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
