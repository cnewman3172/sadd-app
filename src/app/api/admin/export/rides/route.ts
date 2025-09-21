import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

function toCsv(rows: string[][]){
  const esc = (s: any) => {
    const v = s===null||s===undefined ? '' : String(s);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v;
  };
  return rows.map(r=> r.map(esc).join(',')).join('\n') + '\n';
}

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();
  const fromStr = url.searchParams.get('from') || '';
  const toStr = url.searchParams.get('to') || '';
  const where: any = {};
  if (fromStr || toStr){
    const from = fromStr ? new Date(fromStr) : undefined;
    // to = inclusive end-of-day if only date provided
    const to = toStr ? new Date(toStr) : undefined;
    if (from || to){
      where.requestedAt = {} as any;
      if (from) (where.requestedAt as any).gte = from;
      if (to) {
        const end = new Date(to);
        // if midnight, bump to end of the day
        if (end.getHours()===0 && end.getMinutes()===0 && end.getSeconds()===0) {
          end.setHours(23,59,59,999);
        }
        (where.requestedAt as any).lte = end;
      }
    }
  }

  const rides = await prisma.ride.findMany({
    where,
    orderBy: { requestedAt: 'desc' },
    include: {
      rider: { select: { firstName: true, lastName: true, email: true, phone: true, rank: true, unit: true } },
      driver: { select: { firstName: true, lastName: true, email: true } },
    }
  });

  if (format === 'json'){
    return NextResponse.json(rides);
  }

  const header = [
    'ride_code',
    'ride_uuid',
    'rider_name',
    'rider_email',
    'rider_phone',
    'rider_rank',
    'rider_unit',
    'truck_commander_name',
    'truck_commander_email',
    'requested_at',
    'picked_up_at',
    'dropped_at',
    'pickup_address',
    'dropoff_address',
    'rating',
    'review_comment',
  ];
  const rows: string[][] = [header];
  for (const r of rides){
    const riderName = [r.rider?.firstName, r.rider?.lastName].filter(Boolean).join(' ');
    const tcName = [r.driver?.firstName, r.driver?.lastName].filter(Boolean).join(' ');
    rows.push([
      String(r.rideCode),
      r.id,
      riderName,
      r.rider?.email || '',
      r.rider?.phone || '',
      r.rider?.rank || '',
      r.rider?.unit || '',
      tcName,
      r.driver?.email || '',
      r.requestedAt?.toISOString?.() || (r as any).requestedAt || '',
      r.pickupAt?.toISOString?.() || (r as any).pickupAt || '',
      r.dropAt?.toISOString?.() || (r as any).dropAt || '',
      r.pickupAddr,
      r.dropAddr,
      r.rating!=null ? String(r.rating) : '',
      r.reviewComment || '',
    ]);
  }

  const csv = toCsv(rows);
  const filename = `rides_export_${new Date().toISOString().slice(0,10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    }
  });
}
