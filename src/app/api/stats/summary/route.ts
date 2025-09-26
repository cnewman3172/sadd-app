import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function currentFyStartUTC(){
  const now = new Date();
  const y = now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1; // Oct=9
  return new Date(Date.UTC(y, 9, 1, 0, 0, 0));
}

let cache: { ts: number; body: any } | null = null;

export async function GET(){
  const now = Date.now();
  if (cache && now - cache.ts < 5*60*1000){
    return new NextResponse(JSON.stringify(cache.body), { status: 200, headers: { 'Content-Type':'application/json', 'Cache-Control':'public, max-age=300, s-maxage=300, stale-while-revalidate=60' } });
  }
  try{
    const fyStart = currentFyStartUTC();
    const [activeVans, ridesFY, pickup] = await Promise.all([
      prisma.van.count({ where: { status: 'ACTIVE' } }),
      prisma.ride.count({ where: { requestedAt: { gte: fyStart } } }),
      prisma.$queryRawUnsafe<Array<{ avg_seconds: number|null; sample: bigint }>>(
        `SELECT AVG(EXTRACT(EPOCH FROM ("pickupAt" - "requestedAt"))) AS avg_seconds,
                COUNT(*)::bigint AS sample
           FROM "Ride"
          WHERE "pickupAt" IS NOT NULL
            AND "requestedAt" IS NOT NULL
            AND "status" IN ('PICKED_UP','DROPPED')
            AND "requestedAt" >= NOW() - INTERVAL '90 days'`
      ),
    ]);
    // Ensure numeric type for avgSeconds; Prisma raw may return string/Decimal
    const rawAvg = (pickup?.[0] as any)?.avg_seconds ?? null;
    const avgSeconds = rawAvg == null ? null : Number(rawAvg);
    const sample = Number(pickup?.[0]?.sample ?? 0);
    const body = { ok:true, activeVans, ridesFY, fyStart: fyStart.toISOString(), avgSeconds, sample, windowDays: 90 };
    cache = { ts: now, body };
    return new NextResponse(JSON.stringify(body), { status: 200, headers: { 'Content-Type':'application/json', 'Cache-Control':'public, max-age=300, s-maxage=300, stale-while-revalidate=60' } });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || 'failed' }, { status: 500 });
  }
}
