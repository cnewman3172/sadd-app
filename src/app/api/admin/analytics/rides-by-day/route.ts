import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: NextRequest){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days')||'30')));
  const tz = url.searchParams.get('tz') || 'UTC';
  // PostgreSQL: group by local day
  const rows: Array<{ day: string; total: bigint; completed: bigint }>= await prisma.$queryRawUnsafe(
    `SELECT to_char(date_trunc('day', timezone($1, "requestedAt")),'YYYY-MM-DD') AS day,
            COUNT(*)::bigint AS total,
            SUM(CASE WHEN "status"='DROPPED' THEN 1 ELSE 0 END)::bigint AS completed
       FROM "Ride"
      WHERE "requestedAt" >= timezone($1, now()) - interval '${days} days'
      GROUP BY 1
      ORDER BY 1`, tz
  );
  return NextResponse.json(rows.map(r=>({ day: r.day, total: Number(r.total||0), completed: Number(r.completed||0) })));
}

