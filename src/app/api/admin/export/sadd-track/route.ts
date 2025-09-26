import { NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

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

function excelSerialDate(y: number, m: number, d: number){
  const utc = Date.UTC(y, m-1, d);
  const excelEpoch = Date.UTC(1899, 11, 31);
  let days = Math.floor((utc - excelEpoch) / 86400000);
  if (utc >= Date.UTC(1900, 2, 1)) days += 1; // Excel 1900 leap day bug
  return days;
}
function excelSerialTime(h: number, m: number, s: number){
  const secs = h*3600 + m*60 + s;
  return secs / 86400;
}

async function findShiftForInstant(instant: Date){
  return prisma.shift.findFirst({
    where: { startsAt: { lte: instant }, endsAt: { gt: instant } },
    orderBy: { startsAt: 'desc' },
  });
}

function classifyLocation(addr?: string): string{
  const a = (addr||'').toLowerCase();
  const map: Array<{ label:string; match:string[] }> = [
    { label:'Fairbanks International Airport', match:['fairbanks international airport, 6450 airport way, fairbanks, ak','fairbanks international airport'] },
    { label:'City Center Community Activity Center', match:['city center community activity center, 3714 santiago avenue, fairbanks, ak','city center community activity center'] },
    { label:'Midnite Mine', match:['midnite mine, 308 wendell avenue, fairbanks, ak','midnite mine'] },
    { label:'North Pole Ale House', match:['north pole ale house, 2643 old richardson highway, north pole, ak','north pole ale house'] },
    { label:'The Red Fox Bar & Grill', match:['the red fox bar & grill, 398 chena pump road, fairbanks, ak','red fox bar'] },
    { label:'The Round Up', match:['the round up, 2701 south cushman street, fairbanks, ak','round up'] },
    { label:'The Big I', match:['the big-i pub & lounge, 122 north turner street, fairbanks, ak','big-i','big i'] },
    { label:'The Cabin', match:['the cabin, 901 old steese highway, fairbanks, ak','the cabin'] },
    { label:'The Library', match:['the library, 603 lacey street, fairbanks, ak','the library'] },
    { label:'The Spur', match:['the spur, 537 gaffney road, fairbanks, ak','the spur'] },
    { label:'Warrior Zone', match:['the warrior zone, 3205 santiago avenue, fairbanks, ak','warrior zone'] },
  ];
  for (const m of map){ if (m.match.some(x=> a.includes(x))) return m.label; }
  return 'Other';
}

function nameDateForNow(tz: string){
  try{
    const d = new Date();
    const p = localParts(d, tz)!;
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const mon = months[(p.m-1)||0];
    const yy = String(p.y).slice(-2);
    return `${p.da}${mon}${yy}`; // e.g., 1OCT25
  }catch{ return 'Today'; }
}

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const tz = url.searchParams.get('tz') || 'UTC';
  const fromStr = url.searchParams.get('from') || '';
  const toStr = url.searchParams.get('to') || '';
  const templatePath = decodeURIComponent(url.searchParams.get('template') || '/tmp/upload-2197030802/SADD Tracker.xlsx');

  const where: any = {};
  if (fromStr || toStr){
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;
    if (from || to){
      where.requestedAt = {} as any;
      if (from) (where.requestedAt as any).gte = from;
      if (to){
        const end = new Date(to);
        if (end.getHours()===0 && end.getMinutes()===0 && end.getSeconds()===0) end.setHours(23,59,59,999);
        (where.requestedAt as any).lte = end;
      }
    }
  }

  // Fetch rides and shifts/signups we need
  const [rides, shifts] = await Promise.all([
    prisma.ride.findMany({
      where,
      orderBy: { requestedAt: 'asc' },
      include: { rider: { select: { firstName:true, lastName:true, phone:true } }, driver: { select: { firstName:true, lastName:true, email:true } } }
    }),
    prisma.shift.findMany({
      where: (fromStr||toStr) ? {
        startsAt: {
          gte: fromStr ? new Date(fromStr) : undefined,
          lte: toStr ? (()=>{ const e=new Date(toStr); if (e.getHours()===0&&e.getMinutes()===0&&e.getSeconds()===0) e.setHours(23,59,59,999); return e; })() : undefined,
        }
      } : {},
      orderBy: { startsAt: 'asc' },
      include: { signups: { include: { user: { select: { id:true, firstName:true, lastName:true, email:true, phone:true, role:true } } } } }
    })
  ]);

  // Precompute a cache of shifts lookup by instant to avoid many queries: index by day buckets
  // For simplicity, we will look up via Prisma call per ride (could be optimized), but ok for export sizes.

  // Aggregations per shift date (yyyy-mm-dd)
  const dayAgg: Record<string, { dateParts: {y:number;m:number;da:number}; requests:number; picked:number; volunteerIds:Set<string> } > = {};

  // Helper to get/ensure date bucket
  function ensureDayBucket(y:number,m:number,da:number){
    const key = `${y}-${pad2(m)}-${pad2(da)}`;
    if (!dayAgg[key]) dayAgg[key] = { dateParts: { y, m, da }, requests: 0, picked: 0, volunteerIds: new Set() };
    return dayAgg[key];
  }

  // Build ride-derived metrics
  for (const r of rides){
    const shift = await findShiftForInstant(r.requestedAt);
    const parts = localParts((shift?.startsAt ?? r.requestedAt) as any, tz)!;
    const bucket = ensureDayBucket(parts.y, parts.m, parts.da);
    bucket.requests += 1; // all requests regardless of status
    if ((r as any).status === 'DROPPED') bucket.picked += 1; // only completed rides
  }

  // Build volunteer counts only for dates that have rides (specific night)
  const rideKeys = new Set(Object.keys(dayAgg));
  for (const s of shifts){
    const sp = localParts(s.startsAt as any, tz);
    if (!sp) continue;
    const key = `${sp.y}-${pad2(sp.m)}-${pad2(sp.da)}`;
    if (!rideKeys.has(key)) continue; // only count volunteers for nights with rides
    const bucket = dayAgg[key];
    for (const su of s.signups){ bucket.volunteerIds.add(su.userId); }
  }

  // Load Excel template
  const fs = await import('fs/promises');
  let buf: Buffer;
  try{
    buf = await fs.readFile(templatePath);
  }catch(e:any){
    return NextResponse.json({ error:`Template not found at ${templatePath}` }, { status: 400 });
  }
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  // Utility to find header columns by name (row 1 default)
  function headerMap(ws: any, rowIdx=1){
    const row = ws.getRow(rowIdx);
    const map: Record<string, number> = {};
    row.eachCell({ includeEmpty: false }, (cell: any, col: number)=>{
      const key = String(cell.value||'').trim().toLowerCase();
      if (key) map[key] = col;
    });
    return map;
  }

  // Fill Data sheet (daily aggregates)
  const wsData = wb.getWorksheet('Data') || wb.worksheets.find(w=> String(w.name).toLowerCase().includes('data'));
  if (wsData){
    const headers = headerMap(wsData, 1);
    // Clear rows below header
    if (wsData.rowCount > 1) wsData.spliceRows(2, wsData.rowCount-1);
    const keys = Object.keys(dayAgg).sort();
    for (const k of keys){
      const b = dayAgg[k];
      const r = wsData.addRow([]);
      const dateCol = headers['date'] || headers['shift date'] || 1;
      const reqCol = headers['requests'] || headers['total requests'] || 2;
      const pickedCol = headers['picked up'] || headers['completed'] || 3;
      const volCol = headers['volunteers'] || headers['volunteer count'] || 4;
      r.getCell(dateCol).value = excelSerialDate(b.dateParts.y, b.dateParts.m, b.dateParts.da);
      r.getCell(dateCol).numFmt = 'yyyy-mm-dd';
      r.getCell(reqCol).value = b.requests;
      r.getCell(pickedCol).value = b.picked;
      r.getCell(volCol).value = b.volunteerIds.size;
    }
  }

  // Prepare per-ride rows for Time Data and per-volunteer rows
  type RideRow = { dateSerial:number; reqTime:number|null; pickupTime:number|null; dropTime:number|null; location:string; rideCode:number; };
  const rideRows: RideRow[] = [];
  for (const r of rides){
    const shift = await findShiftForInstant(r.requestedAt);
    const dp = localParts((shift?.startsAt ?? r.requestedAt) as any, tz);
    if (!dp) continue;
    const reqP = localParts(r.requestedAt as any, tz);
    const puP = localParts(r.pickupAt as any, tz);
    const drP = localParts(r.dropAt as any, tz);
    rideRows.push({
      dateSerial: excelSerialDate(dp.y, dp.m, dp.da),
      reqTime: reqP ? excelSerialTime(reqP.h, reqP.mi, reqP.s) : null,
      pickupTime: puP ? excelSerialTime(puP.h, puP.mi, puP.s) : null,
      dropTime: drP ? excelSerialTime(drP.h, drP.mi, drP.s) : null,
      location: classifyLocation((r as any).pickupAddr),
      rideCode: (r as any).rideCode,
    });
  }

  const wsTime = wb.getWorksheet('Time Data') || wb.worksheets.find(w=> String(w.name).toLowerCase().includes('time'));
  if (wsTime){
    const headers = headerMap(wsTime, 1);
    // Clear existing data rows
    if (wsTime.rowCount > 1) wsTime.spliceRows(2, wsTime.rowCount-1);
    for (const rr of rideRows){
      const r = wsTime.addRow([]);
      const dateCol = headers['date'] || headers['shift date'] || 1;
      const reqCol = headers['request time'] || headers['requested'] || 2;
      const puCol = headers['pickup time'] || 3;
      const drCol = headers['dropoff time'] || headers['drop time'] || 4;
      const locCol = headers['location'] || headers['pickup location'] || 5;
      const codeCol = headers['ride code'] || headers['ride id'] || 6;
      r.getCell(dateCol).value = rr.dateSerial; r.getCell(dateCol).numFmt = 'yyyy-mm-dd';
      if (rr.reqTime!=null){ r.getCell(reqCol).value = rr.reqTime; r.getCell(reqCol).numFmt = 'hh:mm'; }
      if (rr.pickupTime!=null){ r.getCell(puCol).value = rr.pickupTime; r.getCell(puCol).numFmt = 'hh:mm'; }
      if (rr.dropTime!=null){ r.getCell(drCol).value = rr.dropTime; r.getCell(drCol).numFmt = 'hh:mm'; }
      r.getCell(locCol).value = rr.location;
      r.getCell(codeCol).value = rr.rideCode;
    }
  }

  // Volunteer List sheet
  const wsVol = wb.getWorksheet('Volunteer List') || wb.worksheets.find(w=> String(w.name).toLowerCase().includes('volunteer'));
  if (wsVol){
    const headers = headerMap(wsVol, 1);
    if (wsVol.rowCount > 1) wsVol.spliceRows(2, wsVol.rowCount-1);
    // Only list volunteers for nights with rides
    const rideKeys = new Set(Object.keys(dayAgg));
    for (const s of shifts){
      const dp = localParts(s.startsAt as any, tz);
      if (!dp) continue;
      const key = `${dp.y}-${pad2(dp.m)}-${pad2(dp.da)}`;
      if (!rideKeys.has(key)) continue;
      for (const su of s.signups){
        const u = su.user as any;
        const name = [u?.firstName, u?.lastName].filter(Boolean).join(' ');
        const r = wsVol.addRow([]);
        const dateCol = headers['date'] || headers['shift date'] || 1;
        const nameCol = headers['name'] || headers['full name'] || 2;
        const emailCol = headers['email'] || 3;
        const phoneCol = headers['phone'] || 4;
        const roleCol = headers['role'] || 5;
        const titleCol = headers['title'] || headers['shift'] || 6;
        r.getCell(dateCol).value = excelSerialDate(dp.y, dp.m, dp.da); r.getCell(dateCol).numFmt = 'yyyy-mm-dd';
        r.getCell(nameCol).value = name;
        r.getCell(emailCol).value = u?.email || '';
        r.getCell(phoneCol).value = u?.phone || '';
        r.getCell(roleCol).value = u?.role || '';
        r.getCell(titleCol).value = s.title || '';
      }
    }
  }

  // Filename per request: "SADD Tracker - <TODAY'S DAY>"
  const day = nameDateForNow(tz);
  const filename = `SADD Tracker - ${day}.xlsx`;

  const xbuf: ArrayBuffer = await wb.xlsx.writeBuffer();
  return new NextResponse(xbuf as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    }
  });
}
