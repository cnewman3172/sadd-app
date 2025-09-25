import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// Lazy import for Excel only when needed to keep cold paths light
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

function toCsv(rows: string[][]){
  const esc = (s: any) => {
    const v = s===null||s===undefined ? '' : String(s);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v;
  };
  return rows.map(r=> r.map(esc).join(',')).join('\n') + '\n';
}

function fmtInTz(d: Date | string | null | undefined, tz: string){
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  try{
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz || 'UTC',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p=>p.type===type)?.value ?? '';
    const y = get('year'), m = get('month'), da = get('day');
    const h = get('hour'), mi = get('minute'), s = get('second');
    if (!y || !m || !da) return '';
    // "YYYY-MM-DD HH:mm:ss"
    return `${y}-${m}-${da} ${h||'00'}:${mi||'00'}:${s||'00'}`;
  }catch{
    // Fallback to ISO UTC if tz unsupported
    return (date as Date).toISOString?.() ?? '';
  }
}

function humanizeStatus(s?: string){
  switch(String(s||'').toUpperCase()){
    case 'PENDING': return 'Pending';
    case 'ASSIGNED': return 'Assigned';
    case 'EN_ROUTE': return 'En Route';
    case 'PICKED_UP': return 'Picked Up';
    case 'DROPPED': return 'Dropped Off';
    case 'CANCELED': return 'Canceled';
    default: return s||'';
  }
}

function humanizeVanStatus(s?: string){
  switch(String(s||'').toUpperCase()){
    case 'ACTIVE': return 'Active';
    case 'MAINTENANCE': return 'Maintenance';
    case 'OFFLINE': return 'Offline';
    default: return s||'';
  }
}

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();
  const tz = url.searchParams.get('tz') || 'UTC';
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
      van: { select: { name: true, status: true, passengers: true } },
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
    'contact_name',
    'contact_phone',
    'rider_rank',
    'rider_unit',
    'truck_commander_name',
    'truck_commander_email',
    'van_name',
    'van_status',
    'requested_at',
    'picked_up_at',
    'dropped_at',
    'passengers',
    'pickup_address',
    'dropoff_address',
    'status',
    'rating',
    'review_comment',
    'time_zone',
  ];
  const rows: string[][] = [header];
  for (const r of rides){
    const riderName = [r.rider?.firstName, r.rider?.lastName].filter(Boolean).join(' ');
    const tcName = [r.driver?.firstName, r.driver?.lastName].filter(Boolean).join(' ');
    let contactName = '';
    let contactPhone = '';
    try{
      if (typeof r.notes === 'string' && r.notes.trim().startsWith('{')){
        const meta = JSON.parse(r.notes);
        if (meta?.manualContact){ contactName = meta.manualContact.name || ''; contactPhone = meta.manualContact.phone || ''; }
      }
    }catch{}
    rows.push([
      String(r.rideCode),
      r.id,
      riderName,
      r.rider?.email || '',
      r.rider?.phone || '',
      contactName,
      contactPhone,
      r.rider?.rank || '',
      r.rider?.unit || '',
      tcName,
      r.driver?.email || '',
      r.van?.name || '',
      humanizeVanStatus((r as any).van?.status),
      fmtInTz(r.requestedAt as any, tz),
      fmtInTz(r.pickupAt as any, tz),
      fmtInTz(r.dropAt as any, tz),
      String((r as any).passengers ?? ''),
      r.pickupAddr,
      r.dropAddr,
      humanizeStatus((r as any).status),
      r.rating!=null ? String(r.rating) : '',
      r.reviewComment || '',
      tz,
    ]);
  }

  // New: XLSX workbook export with Rides + Training sheets
  if (format === 'xlsx'){
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();

    // Sheet 1: Rides (same columns as CSV)
    const wsRides = wb.addWorksheet('Rides');
    wsRides.addRow(header);
    for (const row of rows.slice(1)) wsRides.addRow(row);
    wsRides.columns = header.map(()=>({ width: 18 }));

    // Sheet 2: Training (per user)
    const users = await prisma.user.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        unit: true,
        vmisRegistered: true,
        volunteerAgreement: true,
        saddSopRead: true,
        trainingSafetyAt: true,
        trainingDriverAt: true,
        trainingTcAt: true,
        trainingDispatcherAt: true,
        checkRide: true,
      }
    });

    // Humanized statuses
    const status = (b?: boolean|null) => b ? 'Completed' : 'Not Completed';
    const dateStatus = (d?: Date|null) => d ? 'Completed' : 'Not Completed';

    const trainingHeader = [
      'full_name',
      'email',
      'phone',
      'unit',
      'vmis_registered',
      'volunteer_agreement',
      'sadd_sop_read',
      'training_safety',
      'training_driver',
      'training_tc',
      'training_dispatcher',
      'check_ride',
    ];
    const wsTraining = wb.addWorksheet('Training');
    wsTraining.addRow(trainingHeader);
    for (const u of users){
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ');
      wsTraining.addRow([
        fullName,
        u.email ?? '',
        u.phone ?? '',
        u.unit ?? '',
        status(u.vmisRegistered),
        status(u.volunteerAgreement),
        status(u.saddSopRead),
        dateStatus(u.trainingSafetyAt as any),
        dateStatus(u.trainingDriverAt as any),
        dateStatus(u.trainingTcAt as any),
        dateStatus(u.trainingDispatcherAt as any),
        status(u.checkRide),
      ]);
    }
    wsTraining.columns = trainingHeader.map(()=>({ width: 22 }));

    const xbuf: ArrayBuffer = await wb.xlsx.writeBuffer();
    const safeTz = tz.replace(/[^A-Za-z0-9_\-\/]/g,'_').replace(/[\/]/g,'-');
    const filename = `export_${new Date().toISOString().slice(0,10)}_${safeTz}.xlsx`;
    return new NextResponse(xbuf as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      }
    });
  }

  // Default: CSV for rides
  const csv = toCsv(rows);
  const safeTz = tz.replace(/[^A-Za-z0-9_\-\/]/g,'_').replace(/[\/]/g,'-');
  const filename = `rides_export_${new Date().toISOString().slice(0,10)}_${safeTz}.csv`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    }
  });
}
