import { NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// ---------- Helpers ----------
function localParts(d: Date | string | null | undefined, tz: string){
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz || 'UTC', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
  }).formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find(p=>p.type===t)?.value ?? '';
  const y = Number(get('year')), m = Number(get('month')), da = Number(get('day'));
  const h = Number(get('hour')||'0'), mi = Number(get('minute')||'0'), s = Number(get('second')||'0');
  if (!y || !m || !da) return null; return { y, m, da, h, mi, s };
}
function pad2(n:number){ return String(n).padStart(2,'0'); }
function shiftDateParts(d: Date | string, tz: string){
  const p = localParts(d, tz); if (!p) return null; if (p.h < 6){
    const dt = new Date(Date.UTC(p.y, p.m-1, p.da)); dt.setUTCDate(dt.getUTCDate()-1);
    const pp = localParts(dt, tz)!; return { y: pp.y, m: pp.m, da: pp.da };
  }
  return { y: p.y, m: p.m, da: p.da };
}
function excelSerialDate(y:number,m:number,d:number){ const utc=Date.UTC(y,m-1,d); const epoch=Date.UTC(1899,11,31); let days=Math.floor((utc-epoch)/86400000); if (utc>=Date.UTC(1900,2,1)) days+=1; return days; }
function excelSerialTime(h:number,m:number,s:number){ return (h*3600+m*60+s)/86400; }
function classifyLocation(addr?:string){
  const a=(addr||'').toLowerCase(); const chk=(k:string)=>a.includes(k);
  if (chk('fairbanks international airport')) return 'Fairbanks International Airport';
  if (chk('city center community activity center')) return 'City Center Community Activity Center';
  if (chk('midnite mine')) return 'Midnite Mine';
  if (chk('north pole ale house')) return 'North Pole Ale House';
  if (chk('red fox')) return 'The Red Fox Bar & Grill';
  if (chk('round up')) return 'The Round Up';
  if (chk('big-i') || chk('big i')) return 'The Big I';
  if (chk('the cabin')) return 'The Cabin';
  if (chk('the library')) return 'The Library';
  if (chk('the spur')) return 'The Spur';
  if (chk('warrior zone')) return 'Warrior Zone';
  return 'Other';
}
function fnameToday(tz:string){ const p=localParts(new Date(),tz) || {y:2000,m:1,da:1}; const mon=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][(p.m-1)||0]; return `${p.da}${mon}${String(p.y).slice(-2)}`; }

// ---------- Route ----------
export async function GET(req: Request){
  try{
    const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
    const payload = await verifyJwt(token);
    if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const tz = url.searchParams.get('tz') || 'UTC';
    let fromStr = url.searchParams.get('from') || '';
    let toStr = url.searchParams.get('to') || '';
    const fyParam = url.searchParams.get('fy') || '';
    const preview = url.searchParams.get('preview') === '1';
    if (!fromStr && !toStr && fyParam){ const n=Number(String(fyParam).replace(/[^0-9]/g,'')); if (n){ const y2=n>=100?n:2000+n; const y1=y2-1; fromStr=`${y1}-10-01`; toStr=`${y2}-09-30`; } }

    // Build where for DB (±1 day pad)
    const where:any = {};
    if (fromStr || toStr){
      const from = fromStr ? new Date(fromStr) : undefined;
      const to   = toStr   ? new Date(toStr)   : undefined;
      where.requestedAt = {} as any;
      if (from){ const g=new Date(from); g.setUTCDate(g.getUTCDate()-1); (where.requestedAt as any).gte = g; }
      if (to){   const e=new Date(to);   e.setUTCDate(e.getUTCDate()+1); e.setUTCHours(23,59,59,999); (where.requestedAt as any).lte = e; }
    }

    const [rides, shifts, users] = await Promise.all([
      prisma.ride.findMany({ where, orderBy:{ requestedAt:'asc' } }),
      prisma.shift.findMany({ where:{}, orderBy:{ startsAt:'asc' }, include:{ signups:{ include:{ user:{ select:{ id:true } } } } } }),
      prisma.user.findMany({ where:{ role:{ in:['ADMIN','DISPATCHER','TC','DRIVER','SAFETY'] } }, orderBy:[{ lastName:'asc' },{ firstName:'asc' }], select:{ firstName:true,lastName:true,email:true,phone:true,unit:true,role:true,vmisRegistered:true,volunteerAgreement:true,saddSopRead:true,trainingSafetyAt:true,trainingDriverAt:true,trainingTcAt:true,trainingDispatcherAt:true,checkRide:true } })
    ]);

    // Shift-day range helpers
    const fromP = fromStr ? shiftDateParts(new Date(fromStr+'T12:00:00Z'), tz) : null;
    const toP   = toStr   ? shiftDateParts(new Date(toStr  +'T12:00:00Z'), tz) : null;
    const inRange = (p:{y:number;m:number;da:number})=>{
      if (fromP){ const a=p.y*10000+p.m*100+p.da, b=fromP.y*10000+fromP.m*100+fromP.da; if (a<b) return false; }
      if (toP){ const a=p.y*10000+p.m*100+p.da, b=toP.y*10000+toP.m*100+toP.da; if (a>b) return false; }
      return true;
    };

    // Aggregate by shift-day
    const dayAgg = new Map<string,{ y:number;m:number;da:number; requests:number; picked:number; volunteerIds:Set<string> }>();
    const ensure = (p:{y:number;m:number;da:number})=>{ const k=`${p.y}-${pad2(p.m)}-${pad2(p.da)}`; if(!dayAgg.has(k)) dayAgg.set(k,{ y:p.y,m:p.m,da:p.da,requests:0,picked:0,volunteerIds:new Set() }); return dayAgg.get(k)!; };
    for (const r of rides){ const sp=shiftDateParts(r.requestedAt,tz); if(!sp||!inRange(sp)) continue; const d=ensure(sp); d.requests++; if((r as any).status==='DROPPED') d.picked++; }
    const rideKeys = new Set([...dayAgg.keys()]);
    for (const s of shifts){ const sp=localParts(s.startsAt,tz); if(!sp) continue; const key=`${sp.y}-${pad2(sp.m)}-${pad2(sp.da)}`; if(!rideKeys.has(key)) continue; const d=dayAgg.get(key)!; for(const su of s.signups) d.volunteerIds.add(su.userId); }

    if (preview){ let rc=0; for(const r of rides){ const sp=shiftDateParts(r.requestedAt,tz); if(sp&&inRange(sp)) rc++; } const v=new Set<string>(); dayAgg.forEach(x=>x.volunteerIds.forEach(id=>v.add(id))); return NextResponse.json({ from:fromStr||null,to:toStr||null,fy:fyParam||null,nights:dayAgg.size,rides:rc,volunteers:v.size }); }

    // Build fresh workbook
    const ExcelJS = (await import('exceljs')).default; const wb = new ExcelJS.Workbook();

    // Data
    const wsData = wb.addWorksheet('Data'); wsData.views=[{state:'frozen',ySplit:1}]; wsData.columns=[{width:13},{width:16},{width:18},{width:22}];
    wsData.addTable({ name:'DataTable', ref:'A1', headerRow:true, style:{ theme:'TableStyleMedium9', showRowStripes:true }, columns:[ {name:'Date'},{name:'Requests'},{name:'Total Picked Up'},{name:'Number of Volunteers'} ], rows:[] });
    const tData:any = wsData.getTable('DataTable');
    const keys = [...dayAgg.keys()].sort(); for(const k of keys){ const d=dayAgg.get(k)!; tData.addRow([ excelSerialDate(d.y,d.m,d.da), d.requests, d.picked, d.volunteerIds.size ]); }
    tData.commit(); wsData.getColumn(1).numFmt='yyyy-mm-dd';

    // Time Data
    const wsTime = wb.addWorksheet('Time Data'); wsTime.views=[{state:'frozen',ySplit:1}]; wsTime.columns=[{width:13},{width:10},{width:12},{width:14},{width:22},{width:24}];
    wsTime.addTable({ name:'Table2', ref:'A1', headerRow:true, totalsRow:true, style:{ theme:'TableStyleMedium9', showRowStripes:true }, columns:[ {name:'Date'},{name:'Ride ID'},{name:'Pickup Time'},{name:'Drop Off Time'},{name:'Pickup Travel Time (min)'},{name:'Drop Off Travel Time (min)'} ], rows:[] });
    const t2:any = wsTime.getTable('Table2');
    for(const r of rides){ const sp=shiftDateParts(r.requestedAt,tz); if(!sp||!inRange(sp)) continue; if((r as any).status!=='DROPPED') continue; const rq=localParts(r.requestedAt,tz); const pu=localParts(r.pickupAt,tz); const dr=localParts(r.dropAt,tz); const pt=pu?excelSerialTime(pu.h,pu.mi,pu.s):null; const dt=dr?excelSerialTime(dr.h,dr.mi,dr.s):null; const pmin=(rq&&pu)?Math.max(0,Math.round(((pu.h*3600+pu.mi*60+pu.s)-(rq.h*3600+rq.mi*60+rq.s))/60)):null; const dmin=(pu&&dr)?Math.max(0,Math.round(((dr.h*3600+dr.mi*60+dr.s)-(pu.h*3600+pu.mi*60+pu.s))/60)):null; t2.addRow([ excelSerialDate(sp.y,sp.m,sp.da), (r as any).rideCode, pt, dt, pmin, dmin ]); }
    t2.commit(); wsTime.getColumn(1).numFmt='yyyy-mm-dd'; wsTime.getColumn(3).numFmt='hh:mm'; wsTime.getColumn(4).numFmt='hh:mm';

    // Volunteer List (training roster)
    const wsVol = wb.addWorksheet('Volunteer List'); wsVol.views=[{state:'frozen',ySplit:1}]; wsVol.columns=[ {width:24},{width:16},{width:16},{width:18},{width:16},{width:16},{width:16},{width:12},{width:14},{width:18} ];
    wsVol.addTable({ name:'Table1', ref:'A1', headerRow:true, style:{ theme:'TableStyleMedium9', showRowStripes:true }, columns:[ {name:'SADD Volunteer'},{name:'Unit'},{name:'VMIS Enrolled'},{name:'Volunteer Agreement'},{name:'SADD SOP Read'},{name:'Safety Trained'},{name:'Driver Trained'},{name:'Check Ride'},{name:'TC Trained'},{name:'Dispatcher Trained'} ], rows:[] });
    const t1:any = wsVol.getTable('Table1'); const status=(b?:boolean|null)=>b?'Completed':'Not Completed'; const dstatus=(d?:Date|null)=>d?'Completed':'Not Completed';
    for(const u of users){ const name=[u.firstName,u.lastName].filter(Boolean).join(' '); t1.addRow([ name, u.unit||'', status(u.vmisRegistered), status(u.volunteerAgreement), status(u.saddSopRead), dstatus(u.trainingSafetyAt as any), dstatus(u.trainingDriverAt as any), status(u.checkRide), dstatus(u.trainingTcAt as any), dstatus(u.trainingDispatcherAt as any) ]); }
    t1.commit();

    // Location Data
    const wsLoc = wb.addWorksheet('Location Data'); wsLoc.views=[{state:'frozen',ySplit:1}]; const months=['OCT','NOV','DEC','JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP']; wsLoc.columns=[ {width:34}, ...months.map(()=>({width:10})) ]; wsLoc.getCell('A1').value='Location'; months.forEach((m,i)=> wsLoc.getCell(1,i+2).value=m);
    const locs=['Fairbanks International Airport','City Center Community Activity Center','Midnite Mine','North Pole Ale House','The Red Fox Bar & Grill','The Round Up','The Big I','The Cabin','The Library','The Spur','Warrior Zone','Other'];
    const counts:number[][] = Array.from({length:locs.length},()=>Array(12).fill(0));
    for(const r of rides){ if((r as any).status!=='DROPPED') continue; const sp=shiftDateParts(r.requestedAt,tz); if(!sp||!inRange(sp)) continue; const idx=(sp.m+2)%12; const row=locs.indexOf(classifyLocation((r as any).pickupAddr)); if(row>=0) counts[row][idx]++; }
    for(let i=0;i<locs.length;i++){ wsLoc.getCell(i+2,1).value=locs[i]; for(let j=0;j<12;j++) wsLoc.getCell(i+2,j+2).value=counts[i][j]; }
    const totalRow=locs.length+2; wsLoc.getCell(totalRow,1).value='Totals'; for(let j=0;j<12;j++){ const col=String.fromCharCode('A'.charCodeAt(0)+1+j); wsLoc.getCell(totalRow,j+2).value={ formula:`SUM(${col}2:${col}${locs.length+1})` } as any; }

    // Statistics (simple)
    const wsStats = wb.addWorksheet('Statistics'); wsStats.columns=[{width:22},{width:18},{width:18},{width:24}]; wsStats.getCell('A1').value='SADD Tracker Metrics'; wsStats.getCell('A1').font={bold:true,size:16} as any; const rangeText=(fromStr||toStr)?`${fromStr||'—'} to ${toStr||'—'}`:(fyParam?`FY ${String(fyParam).replace(/[^0-9]/g,'')}`:'All Time'); wsStats.getCell('A2').value=`Range: ${rangeText}`; wsStats.getCell('A3').value=`Timezone: ${tz}`;
    wsStats.getCell('A5').value='Requests'; wsStats.getCell('B5').value={ formula:'SUM(DataTable[Requests])' } as any;
    wsStats.getCell('A6').value='Picked Up'; wsStats.getCell('B6').value={ formula:'SUM(DataTable[Total Picked Up])' } as any;
    wsStats.getCell('A7').value='Volunteers'; wsStats.getCell('B7').value={ formula:'SUM(DataTable[Number of Volunteers])' } as any;
    wsStats.getCell('A8').value='Completion Rate'; wsStats.getCell('B8').value={ formula:'IFERROR(SUM(DataTable[Total Picked Up])/SUM(DataTable[Requests]),0)' } as any; wsStats.getCell('B8').numFmt='0%';
    wsStats.getCell('A10').value='Pickup Avg (min)'; wsStats.getCell('B10').value={ formula:'IFERROR(AVERAGE(Table2[Pickup Travel Time (min)]),0)' } as any;
    wsStats.getCell('A11').value='Drop Off Avg (min)'; wsStats.getCell('B11').value={ formula:'IFERROR(AVERAGE(Table2[Drop Off Travel Time (min)]),0)' } as any;

    // Send file
    const day = fnameToday(tz); const filename = `SADD Tracker - ${day}.xlsx`; const xbuf: ArrayBuffer = await wb.xlsx.writeBuffer(); const nodeBuf = Buffer.from(new Uint8Array(xbuf)); const asciiName = `SADD_Tracker_-_${day}.xlsx`; const encodedName = encodeURIComponent(filename).replace(/\*/g,'%2A');
    return new NextResponse(nodeBuf, { headers:{ 'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition':`attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`, 'Content-Length':String(nodeBuf.length), 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' } });
  }catch(e:any){
    return NextResponse.json({ error:'sadd_track_failed', message: e?.message||String(e) }, { status:500 });
  }
}

