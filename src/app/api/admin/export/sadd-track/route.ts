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

// Shift-aligned date: treat 00:00–05:59 as previous day (local tz)
function shiftDateParts(d: Date | string, tz: string){
  const p = localParts(d, tz);
  if (!p) return null;
  if (p.h < 6){
    // subtract one day
    const dt = new Date(Date.UTC(p.y, p.m-1, p.da, p.h, p.mi, p.s));
    dt.setUTCDate(dt.getUTCDate()-1);
    const pp = localParts(dt, tz)!;
    return { y: pp.y, m: pp.m, da: pp.da };
  }
  return { y: p.y, m: p.m, da: p.da };
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
  let fromStr = url.searchParams.get('from') || '';
  let toStr = url.searchParams.get('to') || '';
  const fyParam = url.searchParams.get('fy') || '';
  const preview = url.searchParams.get('preview') === '1';
  // fy can be like 25 or FY25 → means Oct 1, 2024 to Sep 30, 2025
  if (!fromStr && !toStr && fyParam){
    const fyNum = Number(String(fyParam).replace(/[^0-9]/g,''));
    if (fyNum && isFinite(fyNum)){
      const y2 = fyNum >= 100 ? fyNum : 2000 + fyNum; // 25 → 2025
      const y1 = y2 - 1; // Oct 1 previous year
      // Use local tz day boundaries converted to ISO; we still filter in UTC
      fromStr = `${y1}-10-01`;
      toStr = `${y2}-09-30`;
    }
  }
  const defaultTemplate = `${process.cwd()}/public/templates/SADD Tracker.xlsx`;
  const templatePath = decodeURIComponent(url.searchParams.get('template') || defaultTemplate);

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
  const [rides, shifts, users] = await Promise.all([
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
        },
        endsAt: { not: null },
      } : {},
      orderBy: { startsAt: 'asc' },
      include: { signups: { include: { user: { select: { id:true, firstName:true, lastName:true, email:true, phone:true, role:true } } } } }
    }),
    prisma.user.findMany({
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
    })
  ]);

  // Precompute a cache of shifts lookup by instant to avoid many queries: index by day buckets
  // For simplicity, we will look up via Prisma call per ride (could be optimized), but ok for export sizes.

  // Aggregations per shift-aligned date (yyyy-mm-dd with 6am cutoff)
  const dayAgg: Record<string, { dateParts: {y:number;m:number;da:number}; requests:number; picked:number; volunteerIds:Set<string> } > = {};

  // Helper to get/ensure date bucket
  function ensureDayBucket(y:number,m:number,da:number){
    const key = `${y}-${pad2(m)}-${pad2(da)}`;
    if (!dayAgg[key]) dayAgg[key] = { dateParts: { y, m, da }, requests: 0, picked: 0, volunteerIds: new Set() };
    return dayAgg[key];
  }

  // Build ride-derived metrics
  for (const r of rides){
    const parts = shiftDateParts(r.requestedAt as any, tz)!;
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

  if (preview){
    const rideCount = rides.length;
    // Count unique volunteers across nights with rides
    const vSet = new Set<string>();
    Object.values(dayAgg).forEach(d=> d.volunteerIds.forEach(id=> vSet.add(id)));
    return NextResponse.json({
      from: fromStr||null, to: toStr||null, fy: fyParam||null,
      nights: Object.keys(dayAgg).length,
      rides: rideCount,
      volunteers: vSet.size,
    });
  }

  const ExcelJS = (await import('exceljs')).default;
  const fs = await import('fs/promises');
  const wb = new ExcelJS.Workbook();
  let loadedTemplate = false;
  try{
    const buf = await fs.readFile(templatePath);
    await wb.xlsx.load(buf);
    loadedTemplate = true;
  }catch{
    // Will fall back to fresh workbook
  }

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

  function colLetterToNumber(col: string){
    let n = 0;
    for (let i=0;i<col.length;i++){ n = n*26 + (col.charCodeAt(i) - 64); }
    return n;
  }

  // Fill Data sheet (daily aggregates)
  const wsData = (loadedTemplate ? (wb.getWorksheet('Data') || wb.worksheets.find(w=> String(w.name).toLowerCase().includes('data'))) : wb.addWorksheet('Data')) as any;
  if (wsData){
    // Normalize headers: Date, Requests, Total Picked Up, Number of Volunteers
    wsData.getCell('A1').value = 'Date';
    wsData.getCell('B1').value = 'Requests';
    wsData.getCell('C1').value = 'Total Picked Up';
    wsData.getCell('D1').value = 'Number of Volunteers';
    // If a named table exists, reuse; else create one named DataTable
    let table = (wsData as any).getTable?.('DataTable') || (wsData as any).tables?.find((t:any)=>/data(table)?/i.test(t.name||''));
    if (!table && (wsData as any).addTable){
      // Create minimal table
      (wsData as any).addTable({ name:'DataTable', ref:'A1', headerRow: true, totalsRow: false, columns:[
        { name:'Date' }, { name:'Requests' }, { name:'Total Picked Up' }, { name:'Number of Volunteers' }
      ], rows: [] });
      table = (wsData as any).getTable?.('DataTable');
    }
    const keys = Object.keys(dayAgg).sort();
    if (table){
      // Clear table data rows
      const ref: string = (table.table && table.tableRef) || table.tableRef || '';
      const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref||'');
      if (m){
        const startRow = Number(m[2]);
        const endRow = Number(m[4]);
        if (endRow > startRow) wsData.spliceRows(startRow+1, endRow-startRow);
      }
      for (const k of keys){
        const b = dayAgg[k];
        table.addRow([ excelSerialDate(b.dateParts.y,b.dateParts.m,b.dateParts.da), b.requests, b.picked, b.volunteerIds.size ]);
      }
      table.commit?.();
      // Try to format first column date
      const ref2: string = (table.table && table.tableRef) || table.tableRef || '';
      const m2 = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref2||'');
      if (m2){
        const startCol = m2[1];
        const colIndex = colLetterToNumber(startCol);
        wsData.getColumn(colIndex).numFmt = 'yyyy-mm-dd';
      }
    }else{
      const headers = headerMap(wsData, 1);
      if (wsData.rowCount > 1) wsData.spliceRows(2, wsData.rowCount-1);
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
  }

  // Prepare per-ride rows for Time Data and per-volunteer rows
  type RideRow = { dateSerial:number; pickupTime:number|null; dropTime:number|null; pickupMin:number|null; dropMin:number|null; location:string; rideCode:number };
  const rideRows: RideRow[] = [];
  for (const r of rides){
    const shift = await findShiftForInstant(r.requestedAt);
    const dp = shiftDateParts(r.requestedAt as any, tz);
    if (!dp) continue;
    const puP = localParts(r.pickupAt as any, tz);
    const drP = localParts(r.dropAt as any, tz);
    if ((r as any).status !== 'DROPPED') continue; // only successful rides
    const pickupTime = puP ? excelSerialTime(puP.h, puP.mi, puP.s) : null;
    const dropTime = drP ? excelSerialTime(drP.h, drP.mi, drP.s) : null;
    // Precompute durations in minutes
    let pickupMin: number|null = null;
    let dropMin: number|null = null;
    if (puP && r.requestedAt){
      const rqP = localParts(r.requestedAt as any, tz);
      if (rqP){ pickupMin = Math.round(((puP.h*3600+puP.mi*60+puP.s) - (rqP.h*3600+rqP.mi*60+rqP.s)) / 60); }
    }
    if (puP && drP){ dropMin = Math.round(((drP.h*3600+drP.mi*60+drP.s) - (puP.h*3600+puP.mi*60+puP.s)) / 60); }
    rideRows.push({
      dateSerial: excelSerialDate(dp.y, dp.m, dp.da),
      pickupTime,
      dropTime,
      pickupMin,
      dropMin,
      location: classifyLocation((r as any).pickupAddr),
      rideCode: (r as any).rideCode,
    });
  }

  const wsTime = (loadedTemplate ? (wb.getWorksheet('Time Data') || wb.worksheets.find(w=> String(w.name).toLowerCase().includes('time'))) : wb.addWorksheet('Time Data')) as any;
  if (wsTime){
    // Normalize header labels
    wsTime.getCell('A1').value = 'Date';
    wsTime.getCell('B1').value = 'Ride ID';
    wsTime.getCell('C1').value = 'Pickup Time';
    wsTime.getCell('D1').value = 'Drop Off Time';
    wsTime.getCell('E1').value = 'Pickup Travel Time (min)';
    wsTime.getCell('F1').value = 'Drop Off Travel Time (min)';
    // Recreate Table2 with 6 columns if needed
    let table = (wsTime as any).getTable?.('Table2');
    if (table){ try{ (wsTime as any).removeTable('Table2'); }catch{} table = null as any; }
    if ((wsTime as any).addTable){
      (wsTime as any).addTable({ name:'Table2', ref:'A1', headerRow:true, totalsRow:true, columns:[
        { name: 'Date' },
        { name: 'Ride ID' },
        { name: 'Pickup Time' },
        { name: 'Drop Off Time' },
        { name: 'Pickup Travel Time (min)' },
        { name: 'Drop Off Travel Time (min)' },
      ], rows: [] });
      table = (wsTime as any).getTable?.('Table2');
    }
    if (table){
      const ref: string = (table.table && table.tableRef) || table.tableRef || '';
      const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref||'');
      if (m){
        const startRow = Number(m[2]);
        const endRow = Number(m[4]);
        if (endRow > startRow) wsTime.spliceRows(startRow+1, endRow-startRow);
      }
      for (const rr of rideRows){
        const row:any[] = [ rr.dateSerial, rr.rideCode, rr.pickupTime, rr.dropTime, rr.pickupMin, rr.dropMin ];
        table.addRow(row);
      }
      table.commit?.();
      // Apply formats
      const tRef: string = (table.table && table.tableRef) || table.tableRef || '';
      const m2 = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(tRef||'');
      if (m2){
        const startCol = colLetterToNumber(m2[1]);
        wsTime.getColumn(startCol + 0).numFmt = 'yyyy-mm-dd';
        wsTime.getColumn(startCol + 2).numFmt = 'hh:mm';
        wsTime.getColumn(startCol + 3).numFmt = 'hh:mm';
      }
    } else {
      // Fallback to header-based append
      const headers = headerMap(wsTime, 1);
      if (wsTime.rowCount > 1) wsTime.spliceRows(2, wsTime.rowCount-1);
      for (const rr of rideRows){
        const r = wsTime.addRow([]);
        const dateCol = headers['date'] || 1;
        const idCol = headers['ride id'] || 2;
        const puCol = headers['pickup time'] || 3;
        const drCol = headers['drop off time'] || headers['dropoff time'] || 4;
        const pminCol = headers['pickup travel time (min)'] || 5;
        const dminCol = headers['drop off travel time (min)'] || 6;
        r.getCell(dateCol).value = rr.dateSerial; r.getCell(dateCol).numFmt = 'yyyy-mm-dd';
        r.getCell(idCol).value = rr.rideCode;
        if (rr.pickupTime!=null){ r.getCell(puCol).value = rr.pickupTime; r.getCell(puCol).numFmt = 'hh:mm'; }
        if (rr.dropTime!=null){ r.getCell(drCol).value = rr.dropTime; r.getCell(drCol).numFmt = 'hh:mm'; }
        if (rr.pickupMin!=null){ r.getCell(pminCol).value = rr.pickupMin; }
        if (rr.dropMin!=null){ r.getCell(dminCol).value = rr.dropMin; }
      }
    }
  }

  // Volunteer List sheet
  const wsVol = (loadedTemplate ? (wb.getWorksheet('Volunteer List') || wb.worksheets.find(w=> String(w.name).toLowerCase().includes('volunteer'))) : wb.addWorksheet('Volunteer List')) as any;
  if (wsVol){
    // Rebuild Table1 to match training roster: SADD Volunteer, Unit, VMIS Enrolled, Volunteer Agreement, SADD SOP Read, Safety Trained, Driver Trained, Check Ride, TC Trained, Dispatcher Trained
    // Normalize header row
    const headers = ['SADD Volunteer','Unit','VMIS Enrolled','Volunteer Agreement','SADD SOP Read','Safety Trained','Driver Trained','Check Ride','TC Trained','Dispatcher Trained'];
    headers.forEach((h,i)=> wsVol.getCell(1, i+1).value = h);
    // Remove existing Table1 and re-add to cover A1:J1
    let vtable = (wsVol as any).getTable?.('Table1');
    if (vtable){ try{ (wsVol as any).removeTable('Table1'); }catch{} vtable = null as any; }
    if ((wsVol as any).addTable){
      (wsVol as any).addTable({ name:'Table1', ref:'A1', headerRow:true, totalsRow:false, columns: headers.map(n=>({name:n})), rows: [] });
      vtable = (wsVol as any).getTable?.('Table1');
    }
    // Fill from users
    const status = (b?: boolean|null) => b ? 'Completed' : 'Not Completed';
    const dateStatus = (d?: Date|null) => d ? 'Completed' : 'Not Completed';
    if (vtable){
      for (const u of users){
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
        const row:any[] = [
          name,
          u.unit || '',
          status(u.vmisRegistered),
          status(u.volunteerAgreement),
          status(u.saddSopRead),
          dateStatus(u.trainingSafetyAt as any),
          dateStatus(u.trainingDriverAt as any),
          status(u.checkRide),
          dateStatus(u.trainingTcAt as any),
          dateStatus(u.trainingDispatcherAt as any),
        ];
        vtable.addRow(row);
      }
      vtable.commit?.();
    }else{
      if (wsVol.rowCount > 1) wsVol.spliceRows(2, wsVol.rowCount-1);
      for (const u of users){
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
        wsVol.addRow([
          name, u.unit||'', status(u.vmisRegistered), status(u.volunteerAgreement), status(u.saddSopRead),
          dateStatus(u.trainingSafetyAt as any), dateStatus(u.trainingDriverAt as any), status(u.checkRide), dateStatus(u.trainingTcAt as any), dateStatus(u.trainingDispatcherAt as any)
        ]);
      }
    }
  }

  // Populate Location Data sheet by month (OCT..SEP) and location categories
  const wsLoc = (loadedTemplate ? (wb.getWorksheet('Location Data') || wb.worksheets.find(w=> String(w.name).toLowerCase().includes('location'))) : wb.addWorksheet('Location Data')) as any;
  if (wsLoc){
    const months = ['OCT','NOV','DEC','JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP'];
    // Header row
    wsLoc.getCell('A1').value = 'Location';
    months.forEach((m, i)=> wsLoc.getCell(1, i+2).value = m);
    const locs = [
      'Fairbanks International Airport', 'City Center Community Activity Center', 'Midnite Mine', 'North Pole Ale House', 'The Red Fox Bar & Grill', 'The Round Up', 'The Big I', 'The Cabin', 'The Library', 'The Spur', 'Warrior Zone', 'Other'
    ];
    // Zero matrix
    const counts:number[][] = Array.from({ length: locs.length }, ()=> Array(12).fill(0));
    for (const r of rides){
      if ((r as any).status !== 'DROPPED') continue;
      const sp = shiftDateParts(r.requestedAt as any, tz); if (!sp) continue;
      // Month index in FY order with OCT as 0
      const month = sp.m; // 1..12
      const idx = (month+2)%12; // Oct=10 -> 0, Nov=11 ->1, Dec=12 ->2, Jan=1 ->3, ...
      const cat = classifyLocation((r as any).pickupAddr);
      const row = locs.indexOf(cat);
      if (row>=0) counts[row][idx] += 1;
    }
    // Write rows 2..N
    for (let i=0;i<locs.length;i++){
      wsLoc.getCell(i+2, 1).value = locs[i];
      for (let j=0;j<12;j++) wsLoc.getCell(i+2, j+2).value = counts[i][j];
    }
    // Totals row at row 14 (after 12 location rows)
    const totalRow = 14;
    wsLoc.getCell(totalRow,1).value = 'Totals';
    for (let j=0;j<12;j++){
      const colLetter = String.fromCharCode('A'.charCodeAt(0) + 1 + j);
      wsLoc.getCell(totalRow, j+2).value = { formula: `SUM(${colLetter}2:${colLetter}13)` } as any;
    }
  }

  // Filename per request: "SADD Tracker - <TODAY'S DAY>"
  try{
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
  }catch(e:any){
    return NextResponse.json({ error: 'failed_to_generate_workbook', message: e?.message || String(e) }, { status: 500 });
  }
}
