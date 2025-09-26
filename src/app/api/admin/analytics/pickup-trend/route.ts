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
  const rows: Array<{ day:string; avg_seconds: number|null; sample: bigint }>= await prisma.$queryRawUnsafe(
    `WITH daily AS (
       SELECT date_trunc('day', timezone($1, "requestedAt")) AS day,
              EXTRACT(EPOCH FROM ("pickupAt" - "requestedAt")) AS sec
         FROM "Ride"
        WHERE "requestedAt" >= timezone($1, now()) - interval '${days} days'
          AND "requestedAt" IS NOT NULL
          AND "pickupAt" IS NOT NULL
          AND "status" IN ('PICKED_UP','DROPPED')
     )
     SELECT to_char(day,'YYYY-MM-DD') AS day,
            AVG(sec) AS avg_seconds,
            COUNT(*)::bigint AS sample
       FROM daily
      GROUP BY 1
      ORDER BY 1`, tz
  );
  return NextResponse.json(rows.map(r=>({ day: r.day, avgSeconds: r.avg_seconds!=null? Number(r.avg_seconds):null, sample: Number(r.sample||0) })));
}

