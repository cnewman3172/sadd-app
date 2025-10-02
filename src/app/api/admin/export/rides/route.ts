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

// Helpers to work with local date/time parts in a specific timezone
function localParts(d: Date | string | null | undefined, tz: string){
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  try{
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz || 'UTC',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p=>p.type===type)?.value ?? '';
    const y = Number(get('year')); const m = Number(get('month')); const da = Number(get('day'));
    const h = Number(get('hour')||'0'); const mi = Number(get('minute')||'0'); const s = Number(get('second')||'0');
    if (!y || !m || !da) return null;
    return { y, m, da, h, mi, s };
  }catch{
    return null;
  }
}

function pad2(n: number){ return String(n).padStart(2,'0'); }

// HH:mm string in the provided timezone
function timeOnlyStr(d: Date | string | null | undefined, tz: string){
  const p = localParts(d, tz); if (!p) return '';
  return `${pad2(p.h)}:${pad2(p.mi)}`;
}

function formatTimeParts(parts: ReturnType<typeof localParts>){
  if (!parts) return '';
  return `${pad2(parts.h)}:${pad2(parts.mi)}`;
}

// Excel serial date (1900 system) from a local Y-M-D
function excelSerialDate(y: number, m: number, d: number){
  const utc = Date.UTC(y, m-1, d);
  const excelEpoch = Date.UTC(1899, 11, 31); // 1899-12-31
  let days = Math.floor((utc - excelEpoch) / 86400000);
  // Excel's fake 1900 leap day: add 1 for dates >= 1900-03-01
  if (utc >= Date.UTC(1900, 2, 1)) days += 1;
  return days;
}

// Excel serial time as fraction of a day
function excelSerialTime(h: number, m: number, s: number){
  const secs = h*3600 + m*60 + s;
  return secs / 86400;
}

type LocalPartsResult = NonNullable<ReturnType<typeof localParts>>;

function shiftLocalParts(parts: LocalPartsResult, tz: string, days: number){
  const base = new Date(Date.UTC(parts.y, parts.m - 1, parts.da, parts.h, parts.mi, parts.s));
  base.setUTCDate(base.getUTCDate() + days);
  return localParts(base, tz);
}

type LocalDateParts = { y: number; m: number; da: number };

function formatDateParts(parts: LocalDateParts){
  return `${parts.y}-${pad2(parts.m)}-${pad2(parts.da)}`;
}

function formatPhone(phone?: string | null){
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10){
    return `(${digits.slice(0,3)})${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  return phone;
}

function humanizeRole(role?: string | null){
  switch(String(role || '').toUpperCase()){
    case 'TC': return 'Truck Commander';
    case 'DRIVER': return 'Driver';
    case 'DISPATCHER': return 'Dispatcher';
    case 'SAFETY': return 'Safety';
    case 'ADMIN': return 'Admin';
    default: return role || '';
  }
}

function computeRequestDateParts(shift: any, requestLocal: ReturnType<typeof localParts>, tz: string): LocalDateParts | null {
  const base = requestLocal ? { y: requestLocal.y, m: requestLocal.m, da: requestLocal.da } : null;
  if (!requestLocal){
    const shiftLocal = shift ? localParts((shift as any).startsAt as any, tz) : null;
    return shiftLocal ? { y: shiftLocal.y, m: shiftLocal.m, da: shiftLocal.da } : base;
  }

  if (requestLocal.h < 6){
    const shiftLocal = shift ? localParts((shift as any).startsAt as any, tz) : null;
    if (shiftLocal){
      return { y: shiftLocal.y, m: shiftLocal.m, da: shiftLocal.da };
    }
    const previous = shiftLocalParts(requestLocal as LocalPartsResult, tz, -1);
    if (previous){
      return { y: previous.y, m: previous.m, da: previous.da };
    }
  }
  return base;
}

async function findShiftForInstant(instant: Date, role?: 'DISPATCHER'|'TC'|'DRIVER'|'SAFETY'){
  return prisma.shift.findFirst({
    where: { startsAt: { lte: instant }, endsAt: { gt: instant } },
    ...(role ? { role } : {}),
    orderBy: { startsAt: 'desc' },
    include: {
      signups: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true } },
        },
      },
    },
  });
}

function pickTcFromShift(shift: any){
  if (!shift?.signups) return null;
  try{
    const users = (shift.signups as any[]).map(su=>su?.user).filter(Boolean);
    const byRole = users.find(u=>String(u?.role||'').toUpperCase()==='TC');
    if (byRole) return byRole;
    return users[0] || null;
  }catch{
    return null;
  }
}

function normalizeTcMeta(tc: any){
  if (!tc) return null;
  try{
    const firstName = tc.firstName ?? '';
    const lastName = tc.lastName ?? '';
    const name = tc.name ?? tc.fullName ?? '';
    const email = tc.email ?? '';
    const phone = tc.phone ?? '';
    if (firstName || lastName || email || phone){
      return { firstName, lastName, email, phone };
    }
    if (typeof name === 'string' && name.trim()){
      const parts = name.trim().split(/\s+/);
      const first = parts.shift() || '';
      const last = parts.join(' ');
      return { firstName: first, lastName: last, email, phone };
    }
  }catch{}
  return null;
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

// Van status no longer exported

export async function GET(req: Request){
  return handleGet(req);
}

async function handleGet(req: Request){
  const url = new URL(req.url);
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();
  const tz = url.searchParams.get('tz') || 'UTC';

  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });

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

  if (!process.env.DATABASE_URL){
    console.warn('rides export requested without DATABASE_URL configured');
    return respondWithExportError(format, tz, 'missing_database_url');
  }

  let rides: Awaited<ReturnType<typeof prisma.ride.findMany>> = [];
  let walkonActorMap = new Map<string, any>();

  try{
    rides = await prisma.ride.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      include: {
        rider: { select: { firstName: true, lastName: true, email: true, phone: true, rank: true, unit: true } },
        driver: { select: { firstName: true, lastName: true, email: true, phone: true } },
        coordinator: { select: { firstName: true, lastName: true, email: true, phone: true, role: true } },
        van: {
          select: {
            name: true,
            status: true,
            passengers: true,
            activeTcId: true,
            activeTc: { select: { firstName: true, lastName: true, email: true, phone: true, role: true } },
          },
        },
      }
    });

    const rideIds = rides.map(r => r.id);
    const walkonAudits = rideIds.length ? await prisma.audit.findMany({
      where: { action: 'ride_create_walkon', subject: { in: rideIds } },
      orderBy: { createdAt: 'desc' },
    }) : [];
    const walkonActorIds = new Set<string>();
    for (const audit of walkonAudits){
      if (audit.actorId) walkonActorIds.add(audit.actorId);
    }
    const walkonActors = walkonActorIds.size ? await prisma.user.findMany({
      where: { id: { in: Array.from(walkonActorIds) } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true },
    }) : [];
    walkonActorMap = new Map<string, any>();
    const walkonUserById = new Map<string, any>(walkonActors.map(u => [u.id, u]));
    for (const audit of walkonAudits){
      if (!audit.subject) continue;
      if (walkonActorMap.has(audit.subject)) continue;
      if (audit.actorId){
        const actor = walkonUserById.get(audit.actorId);
        if (actor) walkonActorMap.set(audit.subject, actor);
      }
    }
  }catch(err){
    console.error('rides export failed to query database', err);
    return respondWithExportError(format, tz, 'database_query_failed');
  }

  if (format === 'json'){
    return NextResponse.json(rides);
  }

  const header = [
    'Ride Code',
    'Ride UUID',
    "Rider's Name",
    "Rider's Rank",
    "Rider's Email",
    "Rider's Phone Number",
    'Truck Commander',
    "Truck Commander's Email",
    'Van',
    'Request Date',
    'Request Time',
    'Pickup Time',
    'Drop Off Time',
    'Pickup Address',
    'Drop Off Address',
    'Ride Status',
    'Rating',
    'Review Comment',
  ];
  const rows: string[][] = [header];
  for (const r of rides){
    const riderName = [r.rider?.firstName, r.rider?.lastName].filter(Boolean).join(' ');
    let walkOnTc: any = null;
    let manualContactName = '';
    let manualContactPhone = '';
    try{
      if (typeof r.notes === 'string' && r.notes.trim().startsWith('{')){
        const meta = JSON.parse(r.notes);
        if (meta?.manualContact){
          manualContactName = meta.manualContact.name || '';
          manualContactPhone = meta.manualContact.phone || '';
        }
        walkOnTc = normalizeTcMeta(meta?.walkOnTc)
          || normalizeTcMeta(meta?.walkOn?.tc)
          || normalizeTcMeta(meta?.walkOn?.truckCommander)
          || walkOnTc;
      }
    }catch{}
    const effectiveName = manualContactName || riderName;
    const rawPhone = manualContactPhone || r.rider?.phone || '';
    const riderPhone = formatPhone(rawPhone);

    // Compute shift-based request date (falls back to request local date if no shift found)
    const [shift, tcShift] = await Promise.all([
      findShiftForInstant(r.requestedAt),
      r.driver ? Promise.resolve(null) : findShiftForInstant(r.requestedAt, 'TC'),
    ]);
    const tcSignupUser = pickTcFromShift(tcShift) || pickTcFromShift(shift);
    const auditUser = walkonActorMap.get(r.id);
    let tcUser: any = null;
    if (r.coordinator){ tcUser = r.coordinator; }
    else if (tcSignupUser){ tcUser = tcSignupUser; }
    else if (r.van?.activeTc){ tcUser = r.van.activeTc; }
    else if (auditUser){ tcUser = auditUser; }
    else if (walkOnTc){ tcUser = walkOnTc; }
    else if (r.driver){ tcUser = r.driver; }
    const tcName = tcUser ? [tcUser.firstName, tcUser.lastName].filter(Boolean).join(' ') : '';
    const tcEmail = tcUser?.email || '';

    const requestLocal = localParts(r.requestedAt as any, tz);
    const pickupLocal = localParts(r.pickupAt as any, tz);
    const dropLocal = localParts(r.dropAt as any, tz);
    const requestDateParts = computeRequestDateParts(shift, requestLocal, tz);
    const reqDateStr = requestDateParts ? formatDateParts(requestDateParts) : '';

    // Time-only strings for CSV readability and Excel inference
    const reqTimeStr = formatTimeParts(requestLocal);
    const pickupTimeStr = formatTimeParts(pickupLocal);
    const dropTimeStr = formatTimeParts(dropLocal);

    rows.push([
      String(r.rideCode),
      r.id,
      effectiveName,
      r.rider?.rank || '',
      r.rider?.email || '',
      riderPhone,
      tcName,
      tcEmail,
      r.van?.name || '',
      reqDateStr,
      reqTimeStr,
      pickupTimeStr,
      dropTimeStr,
      r.pickupAddr,
      r.dropAddr,
      humanizeStatus((r as any).status),
      r.rating!=null ? String(r.rating) : '',
      r.reviewComment || '',
    ]);
  }

  // New: XLSX workbook export with Rides + Training + Shift Log sheets
  if (format === 'xlsx'){
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();

    // Sheet 1: Rides (columns align with CSV but use typed cells for date/time)
    const wsRides = wb.addWorksheet('Rides');
    wsRides.addRow(header);
    // Column indices for typed formatting (1-based)
    const COL_REQUEST_DATE = header.indexOf('Request Date') + 1;
    const COL_REQUEST_TIME = header.indexOf('Request Time') + 1;
    const COL_PICKUP_TIME = header.indexOf('Pickup Time') + 1;
    const COL_DROPOFF_TIME = header.indexOf('Drop Off Time') + 1;
    for (const r of rides){
      const riderName = [r.rider?.firstName, r.rider?.lastName].filter(Boolean).join(' ');
      let walkOnTc: any = null;
      let manualContactName = '';
      let manualContactPhone = '';
      try{
        if (typeof r.notes === 'string' && r.notes.trim().startsWith('{')){
          const meta = JSON.parse(r.notes);
          if (meta?.manualContact){
            manualContactName = meta.manualContact.name || '';
            manualContactPhone = meta.manualContact.phone || '';
          }
          walkOnTc = normalizeTcMeta(meta?.walkOnTc)
            || normalizeTcMeta(meta?.walkOn?.tc)
            || normalizeTcMeta(meta?.walkOn?.truckCommander)
            || walkOnTc;
        }
      }catch{}
      const effectiveName = manualContactName || riderName;
      const rawPhone = manualContactPhone || r.rider?.phone || '';
      const riderPhone = formatPhone(rawPhone);

      const [shift, tcShift] = await Promise.all([
        findShiftForInstant(r.requestedAt),
        r.driver ? Promise.resolve(null) : findShiftForInstant(r.requestedAt, 'TC'),
      ]);
      const tcSignupUser = pickTcFromShift(tcShift) || pickTcFromShift(shift);
      const auditUser = walkonActorMap.get(r.id);
      let tcUser: any = null;
      if (r.coordinator){ tcUser = r.coordinator; }
      else if (tcSignupUser){ tcUser = tcSignupUser; }
      else if (r.van?.activeTc){ tcUser = r.van.activeTc; }
      else if (auditUser){ tcUser = auditUser; }
      else if (walkOnTc){ tcUser = walkOnTc; }
      else if (r.driver){ tcUser = r.driver; }
      const tcName = tcUser ? [tcUser.firstName, tcUser.lastName].filter(Boolean).join(' ') : '';
      const tcEmail = tcUser?.email || '';

      const requestLocal = localParts(r.requestedAt as any, tz);
      const pickupLocal = localParts(r.pickupAt as any, tz);
      const dropLocal = localParts(r.dropAt as any, tz);
      const requestDateParts = computeRequestDateParts(shift, requestLocal, tz);
      const reqDateSerial = requestDateParts ? excelSerialDate(requestDateParts.y, requestDateParts.m, requestDateParts.da) : null;

      const rowValues: any[] = [
        String(r.rideCode),
        r.id,
        effectiveName,
        r.rider?.rank || '',
        r.rider?.email || '',
        riderPhone,
        tcName,
        tcEmail,
        r.van?.name || '',
        reqDateSerial,
        requestLocal ? excelSerialTime(requestLocal.h, requestLocal.mi, requestLocal.s) : null,
        pickupLocal ? excelSerialTime(pickupLocal.h, pickupLocal.mi, pickupLocal.s) : null,
        dropLocal ? excelSerialTime(dropLocal.h, dropLocal.mi, dropLocal.s) : null,
        r.pickupAddr,
        r.dropAddr,
        humanizeStatus((r as any).status),
        r.rating!=null ? r.rating : null,
        r.reviewComment || '',
      ];
      wsRides.addRow(rowValues);
    }
    wsRides.columns = header.map(()=>({ width: 18 }));
    // Apply formats
    wsRides.getColumn(COL_REQUEST_DATE).numFmt = 'yyyy-mm-dd';
    wsRides.getColumn(COL_REQUEST_TIME).numFmt = 'hh:mm';
    wsRides.getColumn(COL_PICKUP_TIME).numFmt = 'hh:mm';
    wsRides.getColumn(COL_DROPOFF_TIME).numFmt = 'hh:mm';
    const RIDES_PHONE_COL = header.indexOf("Rider's Phone Number") + 1;
    if (RIDES_PHONE_COL > 0){
      wsRides.getColumn(RIDES_PHONE_COL).alignment = { horizontal: 'center' };
    }

    // Sheet 2: Training (per user)
    const users = await prisma.user.findMany({
      where: { role: { in: ['ADMIN','DISPATCHER','TC','DRIVER','SAFETY'] } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        unit: true,
        role: true,
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
      'Name',
      'Email',
      'Phone Number',
      'Unit',
      'Role',
      'VMIS Registered',
      'Volunteer Agreement',
      'SADD SOP Read',
      'Safety Training',
      'Drivers Training',
      'TC Training',
      'Dispatcher Training',
      'Checked Ride',
    ];
    const wsTraining = wb.addWorksheet('Training');
    wsTraining.addRow(trainingHeader);
    const sortedUsers = [...users].sort((a, b) => {
      const nameA = [a.firstName, a.lastName].filter(Boolean).join(' ').trim();
      const nameB = [b.firstName, b.lastName].filter(Boolean).join(' ').trim();
      return nameA.localeCompare(nameB || '', undefined, { sensitivity: 'base' });
    });
    for (const u of sortedUsers){
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ');
      wsTraining.addRow([
        fullName,
        u.email ?? '',
        formatPhone(u.phone),
        u.unit ?? '',
        humanizeRole(u.role),
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
    const TRAINING_PHONE_COL = trainingHeader.indexOf('Phone Number') + 1;
    if (TRAINING_PHONE_COL > 0){
      wsTraining.getColumn(TRAINING_PHONE_COL).alignment = { horizontal: 'center' };
    }

    // Sheet 3: Shift Log (one row per signup)
    const shiftHeader = [
      'Shift ID', 'Role Required', 'Shift Title',
      // Date column, then start/end time-only
      'Shift Date', 'Start Time', 'End Time', 'Required People',
      'User ID', 'Signup Name', 'Signup Email', 'Signup Phone Number', 'Signup Role', 'Signup Time'
    ];
    const wsShift = wb.addWorksheet('Shift Log');
    wsShift.addRow(shiftHeader);
    const cutoff = new Date(Date.now() - 180*24*60*60*1000); // last 180 days default window
    const shifts = await prisma.shift.findMany({
      where: { startsAt: { gte: cutoff } },
      orderBy: { startsAt: 'desc' },
      include: {
        signups: { include: { user: { select: { id:true, firstName:true, lastName:true, email:true, phone:true, role:true } } } },
      },
      take: 2000,
    });
    for (const s of shifts){
      for (const su of s.signups){
        const u = su.user as any;
        const full = [u?.firstName, u?.lastName].filter(Boolean).join(' ');
        const dateP = localParts(s.startsAt as any, tz);
        const dateSerial = dateP ? excelSerialDate(dateP.y, dateP.m, dateP.da) : null;
        const startP = localParts(s.startsAt as any, tz);
        const endP = localParts(s.endsAt as any, tz);
        wsShift.addRow([
          s.id,
          humanizeRole(s.role),
          s.title || '',
          dateSerial,
          startP ? excelSerialTime(startP.h, startP.mi, startP.s) : null,
          endP ? excelSerialTime(endP.h, endP.mi, endP.s) : null,
          String(s.needed),
          u?.id || '',
          full,
          u?.email || '',
          formatPhone(u?.phone),
          humanizeRole(u?.role),
          fmtInTz((su as any).createdAt as any, tz),
        ]);
      }
      if (s.signups.length===0){
        const dateP = localParts(s.startsAt as any, tz);
        const dateSerial = dateP ? excelSerialDate(dateP.y, dateP.m, dateP.da) : null;
        const startP = localParts(s.startsAt as any, tz);
        const endP = localParts(s.endsAt as any, tz);
        wsShift.addRow([
          s.id,
          humanizeRole(s.role),
          s.title || '',
          dateSerial,
          startP ? excelSerialTime(startP.h, startP.mi, startP.s) : null,
          endP ? excelSerialTime(endP.h, endP.mi, endP.s) : null,
          String(s.needed),
          '', '', '', '', '', '',
        ]);
      }
    }
    wsShift.columns = shiftHeader.map(()=>({ width: 20 }));
    // Apply date/time formats to Shift Log
    const COL_S_DATE = shiftHeader.indexOf('Shift Date') + 1;
    const COL_S_START = shiftHeader.indexOf('Start Time') + 1;
    const COL_S_END = shiftHeader.indexOf('End Time') + 1;
    wsShift.getColumn(COL_S_DATE).numFmt = 'yyyy-mm-dd';
    wsShift.getColumn(COL_S_START).numFmt = 'hh:mm';
    wsShift.getColumn(COL_S_END).numFmt = 'hh:mm';
    const SHIFT_PHONE_COL = shiftHeader.indexOf('Signup Phone Number') + 1;
    if (SHIFT_PHONE_COL > 0){
      wsShift.getColumn(SHIFT_PHONE_COL).alignment = { horizontal: 'center' };
    }

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

type ExportErrorReason = 'missing_database_url' | 'database_query_failed';

async function respondWithExportError(format: string, tz: string, reason: ExportErrorReason){
  const { code, message, status } = getErrorDetails(reason);
  const safeTz = tz.replace(/[^A-Za-z0-9_\-\/]/g,'_').replace(/[\/]/g,'-');
  if (format === 'json'){
    return NextResponse.json({ error: code, message }, { status });
  }
  if (format === 'xlsx'){
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Error');
    ws.addRow(['error', 'message']);
    ws.addRow([code, message]);
    ws.columns = [{ width: 24 }, { width: 80 }];
    const buf: ArrayBuffer = await wb.xlsx.writeBuffer();
    const filename = `rides_export_error_${new Date().toISOString().slice(0,10)}_${safeTz}.xlsx`;
    return new NextResponse(buf as any, {
      status,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }
  const csv = toCsv([
    ['error', 'message'],
    [code, message],
  ]);
  const filename = `rides_export_error_${new Date().toISOString().slice(0,10)}_${safeTz}.csv`;
  return new NextResponse(csv, {
    status,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function getErrorDetails(reason: ExportErrorReason){
  switch(reason){
    case 'missing_database_url':
      return {
        code: 'database_not_configured',
        message: 'DATABASE_URL is not configured. Set the connection string so the export can query rides.',
        status: 503,
      } as const;
    case 'database_query_failed':
    default:
      return {
        code: 'database_unavailable',
        message: 'Unable to reach the database to read rides. Check the connection and try again.',
        status: 503,
      } as const;
  }
}
