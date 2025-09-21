import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(){
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
    const avgSeconds = rows?.[0]?.avg_seconds ?? null;
    const sample = Number(rows?.[0]?.sample ?? 0);
    return NextResponse.json({ ok:true, avgSeconds, sample, windowDays: 90 });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || 'failed' }, { status: 500 });
  }
}

