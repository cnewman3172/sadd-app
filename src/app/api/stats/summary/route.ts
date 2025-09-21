import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function currentFyStartUTC(){
  const now = new Date();
  const y = now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1; // Oct=9
  return new Date(Date.UTC(y, 9, 1, 0, 0, 0));
}

export async function GET(){
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
    const avgSeconds = pickup?.[0]?.avg_seconds ?? null;
    const sample = Number(pickup?.[0]?.sample ?? 0);
    return NextResponse.json({ ok:true, activeVans, ridesFY, fyStart: fyStart.toISOString(), avgSeconds, sample, windowDays: 90 });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || 'failed' }, { status: 500 });
  }
}

