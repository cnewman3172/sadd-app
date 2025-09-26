import { prisma } from '@/lib/prisma';

export async function getPublicActive(){
  const s = await prisma.setting.findUnique({ where: { id: 1 } }).catch(()=>null);
  return Boolean(s?.active);
}

export async function getHomeSummary(){
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
  const rawAvg = (pickup?.[0] as any)?.avg_seconds ?? null;
  const avgSeconds = rawAvg == null ? null : Number(rawAvg);
  const sample = Number(pickup?.[0]?.sample ?? 0);
  return { activeVans, ridesFY, avgSeconds, sample };
}

function currentFyStartUTC(){
  const now = new Date();
  const y = now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1; // Oct=9
  return new Date(Date.UTC(y, 9, 1, 0, 0, 0));
}

