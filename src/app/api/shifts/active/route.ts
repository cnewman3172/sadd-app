import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const url = new URL(req.url);
  const role = (url.searchParams.get('role')||'').toUpperCase();
  if (!['COORDINATOR','TC'].includes(role)) return NextResponse.json({ error:'role_required' }, { status: 400 });

  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload) return NextResponse.json({ error:'unauthorized' }, { status: 401 });

  // Admins are always active for all roles
  if (payload.role === 'ADMIN') return NextResponse.json({ active: true, adminBypass: true });

  const now = new Date();
  const s = await prisma.shift.findFirst({
    where: {
      role: role as any,
      startsAt: { lte: now },
      endsAt: { gt: now },
      signups: { some: { userId: payload.uid } },
    },
    select: { id: true, title: true, endsAt: true },
  });

  if (!s) return NextResponse.json({ active: false });
  return NextResponse.json({ active: true, until: s.endsAt.toISOString(), shiftId: s.id, title: s.title||null });
}

