import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

let cache: { ts: number; body: any } | null = null;

export async function GET(){
  const now = Date.now();
  if (cache && now - cache.ts < 5*60*1000){
    return new NextResponse(JSON.stringify(cache.body), { status: 200, headers: { 'Content-Type':'application/json', 'Cache-Control':'public, max-age=300, s-maxage=300, stale-while-revalidate=60' } });
  }
  try{
    // Average seconds between request and pickup for the last 90 days
    const rows: Array<{ avg_seconds: number|null; sample: bigint }>= await prisma.$queryRawUnsafe(
      `SELECT AVG(EXTRACT(EPOCH FROM ("pickupAt" - "requestedAt"))) AS avg_seconds,
              COUNT(*)::bigint AS sample
         FROM "Ride"
        WHERE "pickupAt" IS NOT NULL
          AND "requestedAt" IS NOT NULL
          AND "status" IN ('PICKED_UP','DROPPED')
          AND "requestedAt" >= NOW() - INTERVAL '90 days'`
    );
    // Coerce to number; SQL drivers may return text for AVG
    const rawAvg = (rows?.[0] as any)?.avg_seconds ?? null;
    const avgSeconds = rawAvg == null ? null : Number(rawAvg);
    const sample = Number(rows?.[0]?.sample ?? 0);
    const body = { ok:true, avgSeconds, sample, windowDays: 90 };
    cache = { ts: now, body };
    return new NextResponse(JSON.stringify(body), { status: 200, headers: { 'Content-Type':'application/json', 'Cache-Control':'public, max-age=300, s-maxage=300, stale-while-revalidate=60' } });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || 'failed' }, { status: 500 });
  }
}
