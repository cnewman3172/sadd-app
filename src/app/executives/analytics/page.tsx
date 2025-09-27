"use client";
import { useEffect, useState, type ReactNode } from 'react';
import { LineChart, BarChart } from '@/components/Charts';

type Summary = {
  totalUsers:number;
  totalRides:number;
  activeRides:number;
  ridesToday:number;
  activeVans:number;
  completedRides?: number;
  canceledRides?: number;
  avgPickupSeconds?: number|null;
  avgDropSeconds?: number|null;
  ratings?: { average:number|null; lowCount:number; highCount:number; totalReviews:number };
};

export default function AnalyticsPage(){
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ridesByDay, setRidesByDay] = useState<Array<{day:string; total:number; completed:number}>>([]);
  const [pickupTrend, setPickupTrend] = useState<Array<{day:string; avgSeconds:number|null; sample:number}>>([]);
  const [coverage, setCoverage] = useState<Array<{day:string; shifts:number; needed:number; signups:number; coverage:number|null}>>([]);
  const [dropTrend, setDropTrend] = useState<Array<{day:string; avgSeconds:number|null; sample:number}>>([]);

  useEffect(()=>{
    (async()=>{
      const s = await fetch('/api/admin/summary', { cache: 'no-store' }).then(r=>r.json());
      setSummary(s);
      try{
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const [rb, pt, sc, dt] = await Promise.all([
          fetch(`/api/admin/analytics/rides-by-day?days=30&tz=${encodeURIComponent(tz)}`, { cache:'no-store' }).then(r=>r.json()).catch(()=>[]),
          fetch(`/api/admin/analytics/pickup-trend?days=30&tz=${encodeURIComponent(tz)}`, { cache:'no-store' }).then(r=>r.json()).catch(()=>[]),
          fetch(`/api/admin/analytics/shift-coverage?days=30&tz=${encodeURIComponent(tz)}`, { cache:'no-store' }).then(r=>r.json()).catch(()=>[]),
          fetch(`/api/admin/analytics/drop-trend?days=30&tz=${encodeURIComponent(tz)}`, { cache:'no-store' }).then(r=>r.json()).catch(()=>[]),
        ]);
        setRidesByDay(rb||[]); setPickupTrend(pt||[]); setCoverage(sc||[]); setDropTrend(dt||[]);
      }catch{}
    })();
  },[]);

  // Derived series for small, side-by-side charts
  const ridesTotal = ridesByDay.map(r=>r.total);
  const ridesCompleted = ridesByDay.map(r=>r.completed);
  const completionRate = ridesByDay.map(r=> r.total? (r.completed/r.total)*100 : 0);
  const cancellations = ridesByDay.map(r=> Math.max(0, r.total - r.completed));
  const pickupMins = pickupTrend.map(r=> r.avgSeconds!=null ? r.avgSeconds/60 : 0);
  const dropMins = dropTrend.map(r=> r.avgSeconds!=null ? r.avgSeconds/60 : 0);
  const coveragePct = coverage.map(r=> r.coverage!=null ? r.coverage : (r.needed? (r.signups/r.needed)*100 : 0));

  const [ridesTodayVal, ridesTodayDelta] = lastAndDelta(ridesTotal);
  const [completedTodayVal, completedTodayDelta] = lastAndDelta(ridesCompleted);
  const [completionTodayVal, completionTodayDelta] = lastAndDelta(completionRate);
  const [pickupTodayVal, pickupTodayDelta] = lastAndDelta(pickupMins, 7, true);
  const [dropTodayVal, dropTodayDelta] = lastAndDelta(dropMins, 7, true);
  const [coverageTodayVal, coverageTodayDelta] = lastAndDelta(coveragePct);

  // Weekday distribution from last 30 days
  const weekdayTotals: number[] = Array(7).fill(0);
  ridesByDay.forEach(r=>{
    const d = new Date(r.day);
    const w = isNaN(d.getTime()) ? 0 : d.getUTCDay();
    weekdayTotals[w] += r.completed;
  });
  const weekdayLabels = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  return (
    <div className="grid gap-6">
      <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
        <h2 className="font-semibold mb-3">Key Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Metric title="Users" value={summary?.totalUsers?.toString() ?? '—'} />
          <Metric title="Completed Rides" value={summary?.completedRides?.toString() ?? '—'} />
          <Metric title="Canceled/No-Show" value={summary?.canceledRides?.toString() ?? '—'} />
          <Metric title="Avg Pickup Time" value={summary?.avgPickupSeconds!=null ? `${Math.round((summary!.avgPickupSeconds||0)/60)} min` : '—'} />
          <Metric title="Avg Drop-off Time" value={summary?.avgDropSeconds!=null ? `${Math.round((summary!.avgDropSeconds||0)/60)} min` : '—'} />
          <Metric title="Avg Rating" value={summary?.ratings?.average ? summary!.ratings!.average!.toFixed(2) + ' ★' : '—'} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <SmallExplainer label="Today rides" value={ridesTodayVal} delta={ridesTodayDelta} suffix="" />
          <SmallExplainer label="Today completed" value={completedTodayVal} delta={completedTodayDelta} suffix="" />
          <SmallExplainer label="Completion rate" value={completionTodayVal} delta={completionTodayDelta} suffix="%" />
        </div>
        <ExportAndResetRow />
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Rides Per Day" subtitle="Last 30 days" stat={fmtNumber(ridesTodayVal)} delta={ridesTodayDelta}>
          {ridesByDay.length===0 ? (
            <div className="text-sm opacity-70">Loading…</div>
          ) : (
            <div>
              <LineChart points={ridesByDay.map((r,i)=>({ x:i, y:r.total }))} color="#6b7280" fill className="h-24" />
              <LineChart points={ridesByDay.map((r,i)=>({ x:i, y:r.completed }))} color="#0ea5e9" className="h-16 -mt-8" />
              <div className="text-[11px] opacity-70 mt-1 flex items-center gap-3">
                <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-1 bg-[#6b7280]"></span>Total</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-1 bg-[#0ea5e9]"></span>Completed</span>
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Completion Rate" subtitle="% completed of total" stat={fmtNumber(completionTodayVal) + '%'} delta={completionTodayDelta}>
          {completionRate.length===0 ? (
            <div className="text-sm opacity-70">No data</div>
          ) : (
            <LineChart points={completionRate.map((v,i)=>({x:i,y:v}))} color="#22c55e" fill className="h-24" yMax={100} />
          )}
        </ChartCard>

        <ChartCard title="Cancellations" subtitle="Total - completed" stat={fmtNumber(cancellations.at(-1) || 0)} delta={percentDeltaFromSeries(cancellations)}>
          {cancellations.length===0 ? (
            <div className="text-sm opacity-70">No data</div>
          ) : (
            <BarChart bars={cancellations.map((v,i)=>({ label: String(i+1), value: v }))} color="#f97316" className="h-24" />
          )}
        </ChartCard>

        <ChartCard title="Pickup Time" subtitle="Minutes (avg)" stat={fmtNumber(pickupTodayVal)} delta={pickupTodayDelta} suffix=" min">
          {pickupMins.length===0 ? (
            <div className="text-sm opacity-70">No data</div>
          ) : (
            <LineChart points={pickupMins.map((v,i)=>({x:i,y:v}))} color="#16a34a" fill className="h-24" />
          )}
        </ChartCard>

        <ChartCard title="Drop-off Time" subtitle="Minutes (avg)" stat={fmtNumber(dropTodayVal)} delta={dropTodayDelta} suffix=" min">
          {dropMins.length===0 ? (
            <div className="text-sm opacity-70">No data</div>
          ) : (
            <LineChart points={dropMins.map((v,i)=>({x:i,y:v}))} color="#ef4444" fill className="h-24" />
          )}
        </ChartCard>

        <ChartCard title="Coverage %" subtitle="Signups vs needed" stat={fmtNumber(coverageTodayVal) + '%'} delta={coverageTodayDelta}>
          {coveragePct.length===0 ? (
            <div className="text-sm opacity-70">No data</div>
          ) : (
            <LineChart points={coveragePct.map((v,i)=>({x:i,y:v}))} color="#6366f1" fill className="h-24" yMax={150} />
          )}
        </ChartCard>

        <ChartCard title="By Weekday" subtitle="Completed rides (last 30d)" stat={''}>
          {ridesByDay.length===0 ? (
            <div className="text-sm opacity-70">No data</div>
          ) : (
            <BarChart bars={weekdayTotals.map((v,i)=>({ label: weekdayLabels[i], value: v }))} color="#0ea5e9" className="h-24" />
          )}
        </ChartCard>
      </div>

      {/* Reset moved inline with Export above */}
    </div>
  );
}

function Metric({title, value}:{title:string; value:string}){
  return (
    <div className="rounded-lg p-3 bg-white/60 dark:bg-white/5 border border-white/20">
      <div className="text-xs opacity-70">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function SmallExplainer({ label, value, delta, suffix='' }:{ label:string; value:number|null; delta:number|null; suffix?:string }){
  const val = value==null ? '—' : `${fmtNumber(value)}${suffix}`;
  const d = delta==null ? '' : `${delta>0?'+':''}${fmtNumber(delta)}%`;
  const color = delta==null? 'opacity-60' : (delta>0? 'text-emerald-600 dark:text-emerald-400' : delta<0 ? 'text-red-600 dark:text-red-400' : 'opacity-60');
  return (
    <div className="rounded-lg p-3 bg-white/60 dark:bg-white/5 border border-white/20">
      <div className="text-xs opacity-70">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-lg font-semibold tabular-nums">{val}</div>
        <div className={`text-xs tabular-nums ${color}`}>{d}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, stat, delta, suffix='', children }:{ title:string; subtitle?:string; stat:string; delta:number|null; suffix?:string; children: ReactNode }){
  const color = delta==null? 'opacity-60' : (delta>0? 'text-emerald-600 dark:text-emerald-400' : delta<0 ? 'text-red-600 dark:text-red-400' : 'opacity-60');
  const d = delta==null ? '' : `${delta>0?'+':''}${fmtNumber(delta)}%`;
  return (
    <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {subtitle && <div className="text-xs opacity-70">{subtitle}</div>}
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold tabular-nums">{stat}{suffix}</div>
          <div className={`text-xs tabular-nums ${color}`}>{d}</div>
        </div>
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

// Helpers
function lastAndDelta(series:number[], window=7, lowerIsBetter=false): [number|null, number|null]{
  if (!series || series.length===0) return [null, null];
  const last = series[series.length-1] ?? null;
  if (series.length < 2) return [last, null];
  const start = Math.max(0, series.length-1-window);
  const prev = series.slice(start, series.length-1);
  const prevAvg = prev.reduce((a,b)=>a+b,0) / (prev.length || 1);
  if (!isFinite(prevAvg) || prevAvg===0) return [last, null];
  const raw = ((last! - prevAvg) / prevAvg) * 100;
  const delta = lowerIsBetter ? -raw : raw;
  return [last, Math.round(delta*10)/10];
}

function percentDeltaFromSeries(series:number[]): number|null{
  const [, d] = lastAndDelta(series, 7, false);
  return d;
}

function fmtNumber(x:number|null): string{
  if (x==null || !isFinite(x)) return '—';
  const abs = Math.abs(x);
  if (abs>=1000) return Math.round(x).toLocaleString();
  if (abs>=100) return Math.round(x).toString();
  return new Intl.NumberFormat(undefined,{ maximumFractionDigits:1 }).format(x);
}

function Bar({ label, value, max }:{ label:string; value:number; max:number }){
  const pct = Math.round((value / (max || 1)) * 100);
  return (
    <div className="grid grid-cols-12 items-center gap-2">
      <div className="col-span-3 md:col-span-2 text-sm opacity-80">{label}</div>
      <div className="col-span-8 md:col-span-9 h-3 rounded bg-black/10 dark:bg-white/10">
        <div className="h-3 rounded bg-black dark:bg-white" style={{ width: `${pct}%` }} />
      </div>
      <div className="col-span-1 text-right text-sm tabular-nums">{value}</div>
    </div>
  );
}

function ExportAndResetRow(){
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tz, setTz] = useState('');
  const [fy, setFy] = useState('');
  const [hasFyData, setHasFyData] = useState<boolean>(true);
  useEffect(()=>{
    try{
      const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (z) setTz(z);
    }catch{}
  },[]);
  const baseXlsx = '/api/admin/export/rides?format=xlsx';
  const hrefXlsx = baseXlsx
    + (from?`&from=${encodeURIComponent(from)}`:'')
    + (to?`&to=${encodeURIComponent(to)}`:'')
    + (tz?`&tz=${encodeURIComponent(tz)}`:'');
  const hrefSadd = '/api/admin/export/sadd-track'
    + (fy?`?fy=${encodeURIComponent(fy)}`:(from?`?from=${encodeURIComponent(from)}`:''))
    + (from||to ? `${fy?'&':''}${from&&to?'&':''}${to?`to=${encodeURIComponent(to)}`:''}`:'')
    + `${(fy||from||to)?'&':'?'}tz=${encodeURIComponent(tz||'UTC')}`;

  // FY helpers
  function fyBounds(label:string){
    const n = Number(String(label).replace(/[^0-9]/g,''));
    if (!n) return null;
    const y2 = n>=100? n : 2000+n; const y1 = y2-1;
    return { from: `${y1}-10-01`, to: `${y2}-09-30` };
  }

  useEffect(()=>{
    let ignore=false;
    (async()=>{
      const qp = fy
        ? `fy=${encodeURIComponent(fy)}`
        : [from && `from=${encodeURIComponent(from)}`, to && `to=${encodeURIComponent(to)}`]
            .filter(Boolean)
            .join('&');
      const url = `/api/admin/export/sadd-track?preview=1${qp?`&${qp}`:''}&tz=${encodeURIComponent(tz||'UTC')}`;
      try{
        const r = await fetch(url, { cache:'no-store' });
        if (!r.ok) { if(!ignore) setHasFyData(false); return; }
        const d = await r.json();
        if (!ignore) setHasFyData((d?.rides||0) > 0);
      }catch{ if(!ignore) setHasFyData(false); }
    })();
    return ()=>{ ignore=true; };
  }, [fy, from, to, tz]);
  return (
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs opacity-70">Fiscal Year</label>
              <select value={fy} onChange={(e)=>{
                const v = e.target.value; setFy(v);
                if (v){ const b = fyBounds(v); if (b){ setFrom(b.from); setTo(b.to); } }
              }} className="block p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm text-black dark:text-white">
                <option value="">Custom</option>
                {['FY24','FY25','FY26','FY27'].map(x=> <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs opacity-70">From</label>
          <input type="date" value={from} onChange={(e)=> setFrom(e.target.value)} className="block p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm text-black dark:text-white" />
            </div>
            <div>
              <label className="text-xs opacity-70">To</label>
          <input type="date" value={to} onChange={(e)=> setTo(e.target.value)} className="block p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm text-black dark:text-white" />
            </div>
            <a className="rounded border px-3 py-2 text-sm" href={hrefXlsx}>Export Data</a>
            <a className={`rounded border px-3 py-2 text-sm ${hasFyData? '' : 'pointer-events-none opacity-50'}`} aria-disabled={!hasFyData} href={hasFyData? hrefSadd : undefined}>Export SADD Tracker</a>
            {tz && <div className="text-xs opacity-60 ml-2">Times in {tz}</div>}
          </div>
      <div className="ml-auto">
        <ResetRidesInline />
      </div>
    </div>
  );
}

function ResetRidesInline(){
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [ok, setOk] = useState(false);

  async function prepare(){
    setError(null); setOk(false);
    const r = await fetch('/api/admin/reset-rides');
    if (!r.ok){ setError('Not authorized'); return; }
    const d = await r.json();
    setToken(d.token);
    setOpen(true);
  }
  async function confirm(){
    if (!token) return;
    setBusy(true); setError(null);
    try{
      const r = await fetch('/api/admin/reset-rides', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ token, phrase }) });
      if (!r.ok){ const d = await r.json().catch(()=>({error:'failed'})); throw new Error(d.error||'failed'); }
      setOk(true); setOpen(false);
      (await import('@/components/Toast')).showToast('All rides cleared');
    }catch(e:any){ setError(e.message||'failed'); }
    finally{ setBusy(false); }
  }

  return (
    <div className="relative">
      <button onClick={prepare} className="rounded border px-3 py-2 text-sm border-red-400 text-red-700 dark:text-red-300">Reset Ride Data…</button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 p-3 rounded border bg-white text-black dark:bg-neutral-900 dark:text-white shadow">
          <div className="text-xs opacity-80 mb-2">Type <span className="font-semibold">RESET ALL RIDES</span> to confirm. This deletes all rides and clears live van state.</div>
          <input value={phrase} onChange={(e)=> setPhrase(e.target.value)} className="w-full p-2 rounded border mb-2 text-sm" placeholder="RESET ALL RIDES" />
          <div className="flex gap-2 justify-end">
            <button onClick={()=> setOpen(false)} className="rounded px-3 py-1 border text-sm">Cancel</button>
            <button disabled={busy || phrase!== 'RESET ALL RIDES'} onClick={confirm} className="rounded px-3 py-1 border text-sm">Confirm</button>
          </div>
          {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
          {ok && <div className="mt-2 text-xs text-green-700">All rides cleared.</div>}
        </div>
      )}
    </div>
  );
}
