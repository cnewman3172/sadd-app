"use client";
import { useEffect, useState } from 'react';

type Summary = { totalUsers:number; totalRides:number; activeRides:number; ridesToday:number; activeVans:number; ratings?: { average:number|null; lowCount:number; highCount:number; totalReviews:number } };

export default function AnalyticsPage(){
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [smtpConfigured, setSmtpConfigured] = useState<boolean|null>(null);
  const [smtpMissing, setSmtpMissing] = useState<string>('');

  useEffect(()=>{
    (async()=>{
      const s = await fetch('/api/admin/summary', { cache: 'no-store' }).then(r=>r.json());
      setSummary(s);
      try{
        const ping = await fetch('/api/admin/smtp-test', { cache: 'no-store' });
        if (ping.ok){
          const d = await ping.json();
          setSmtpConfigured(Boolean(d?.configured));
          if (!d?.configured && d?.details){
            const miss = Object.entries(d.details).filter(([k,v]:any)=>!v).map(([k])=>k.toUpperCase()).join(', ');
            setSmtpMissing(miss);
          }else{ setSmtpMissing(''); }
        } else {
          setSmtpConfigured(false);
        }
      }catch{ setSmtpConfigured(false); }
      const statuses = ['PENDING','ASSIGNED','EN_ROUTE','PICKED_UP','DROPPED','CANCELED'];
      const results = await Promise.all(statuses.map(st => fetch(`/api/rides?status=${st}&take=200`, { cache: 'no-store' }).then(r=>r.json()).then((arr:any[])=>[st, arr.length] as const)));
      setStatusCounts(Object.fromEntries(results));
    })();
  },[]);

  return (
    <div className="grid gap-6">
      <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
        <h2 className="font-semibold mb-3">Key Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metric title="Users" value={summary?.totalUsers?.toString() ?? '—'} />
          <Metric title="Total Rides" value={summary?.totalRides?.toString() ?? '—'} />
          <Metric title="Rides Today" value={summary?.ridesToday?.toString() ?? '—'} />
          <Metric title="Active Rides" value={summary?.activeRides?.toString() ?? '—'} />
          <Metric title="Active Vans" value={summary?.activeVans?.toString() ?? '—'} />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Metric title="Avg Rating" value={summary?.ratings?.average ? summary!.ratings!.average!.toFixed(2) + ' ★' : '—'} />
          <Metric title="High Reviews (4–5★)" value={String(summary?.ratings?.highCount ?? '—')} />
          <Metric title="Low Reviews (1–3★)" value={String(summary?.ratings?.lowCount ?? '—')} />
        </div>
        <div className="mt-3 text-xs opacity-70">
          SMTP: {smtpConfigured==null ? 'Checking…' : smtpConfigured ? 'Configured' : `Not configured${smtpMissing?` (missing: ${smtpMissing})`:''}`}
        </div>
        <ExportAndResetRow />
      </section>

      <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
        <h2 className="font-semibold mb-3">Ride Status Breakdown</h2>
        <div className="space-y-2">
          {Object.entries(statusCounts).map(([st, n])=> (
            <Bar key={st} label={st} value={n} max={Math.max(1, ...Object.values(statusCounts))} />
          ))}
          {Object.keys(statusCounts).length===0 && <div className="text-sm opacity-70">Loading…</div>}
        </div>
      </section>

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
  return (
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs opacity-70">From</label>
          <input type="date" value={from} onChange={(e)=> setFrom(e.target.value)} className="block p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm text-black dark:text-white" />
            </div>
            <div>
              <label className="text-xs opacity-70">To</label>
          <input type="date" value={to} onChange={(e)=> setTo(e.target.value)} className="block p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm text-black dark:text-white" />
            </div>
            <a className="rounded border px-3 py-2 text-sm" href={hrefXlsx}>Export Data</a>
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
