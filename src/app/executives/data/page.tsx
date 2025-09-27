"use client";
import { useEffect, useState } from 'react';

export default function DataPage(){
  return (
    <div className="grid gap-6">
      <ExportRides />
      <ExportSaddTracker />
      <ResetRidesCard />
    </div>
  );
}

function ExportRides(){
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tz, setTz] = useState('');
  useEffect(()=>{
    try{ const z = Intl.DateTimeFormat().resolvedOptions().timeZone; if (z) setTz(z); }catch{}
  },[]);
  const hrefCsv = '/api/admin/export/rides'
    + (from?`?from=${encodeURIComponent(from)}`:'')
    + (to?`${from?'&':'?'}to=${encodeURIComponent(to)}`:'')
    + `${(from||to)?'&':'?'}tz=${encodeURIComponent(tz||'UTC')}`;
  const hrefXlsx = '/api/admin/export/rides?format=xlsx'
    + (from?`&from=${encodeURIComponent(from)}`:'')
    + (to?`&to=${encodeURIComponent(to)}`:'')
    + (tz?`&tz=${encodeURIComponent(tz)}`:'');
  return (
    <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
      <h2 className="font-semibold mb-3">Rides Export</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs opacity-70">From</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="block p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm" />
        </div>
        <div>
          <label className="text-xs opacity-70">To</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="block p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm" />
        </div>
        <div className="text-xs opacity-60">Times in {tz||'UTC'}</div>
      </div>
      <div className="mt-3 flex gap-2">
        <a className="rounded border px-3 py-2 text-sm" href={hrefCsv}>Export CSV</a>
        <a className="rounded border px-3 py-2 text-sm" href={hrefXlsx}>Export XLSX</a>
      </div>
    </section>
  );
}

function ExportSaddTracker(){
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tz, setTz] = useState('');
  const [fy, setFy] = useState('');
  const [hasData, setHasData] = useState(true);

  useEffect(()=>{ try{ const z = Intl.DateTimeFormat().resolvedOptions().timeZone; if (z) setTz(z); }catch{} },[]);

  function fyBounds(label:string){
    const n = Number(String(label).replace(/[^0-9]/g,''));
    if (!n) return null; const y2 = n>=100? n : 2000+n; const y1 = y2-1; return { from: `${y1}-10-01`, to: `${y2}-09-30` };
  }

  useEffect(()=>{
    let ignore=false;
    (async()=>{
      const qp = fy ? `fy=${encodeURIComponent(fy)}` : [from && `from=${encodeURIComponent(from)}`, to && `to=${encodeURIComponent(to)}`].filter(Boolean).join('&');
      const url = `/api/admin/export/sadd-track?preview=1${qp?`&${qp}`:''}&tz=${encodeURIComponent(tz||'UTC')}`;
      try{ const r = await fetch(url,{cache:'no-store'}); if(!r.ok){ if(!ignore) setHasData(false); return;} const d = await r.json(); if(!ignore) setHasData((d?.rides||0)>0);}catch{ if(!ignore) setHasData(false); }
    })();
    return ()=>{ ignore=true };
  },[fy,from,to,tz]);

  const href = '/api/admin/export/sadd-track'
    + (fy?`?fy=${encodeURIComponent(fy)}`:(from?`?from=${encodeURIComponent(from)}`:''))
    + (from||to ? `${fy?'&':''}${from&&to?'&':''}${to?`to=${encodeURIComponent(to)}`:''}`:'')
    + `${(fy||from||to)?'&':'?'}tz=${encodeURIComponent(tz||'UTC')}`;

  return (
    <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
      <h2 className="font-semibold mb-3">SADD Tracker Export</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs opacity-70">Fiscal Year</label>
          <select value={fy} onChange={(e)=>{ const v=e.target.value; setFy(v); if(v){ const b=fyBounds(v); if(b){ setFrom(b.from); setTo(b.to); } } }} className="block p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm">
            <option value="">Custom</option>
            {['FY24','FY25','FY26','FY27'].map(x=> <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs opacity-70">From</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="block p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm" />
        </div>
        <div>
          <label className="text-xs opacity-70">To</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="block p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm" />
        </div>
        <div className="text-xs opacity-60">Times in {tz||'UTC'}</div>
      </div>
      <div className="mt-3">
        <a className={`rounded border px-3 py-2 text-sm ${hasData?'':'pointer-events-none opacity-50'}`} aria-disabled={!hasData} href={hasData? href : undefined}>Export SADD Tracker</a>
        {!hasData && <div className="mt-2 text-xs opacity-70">No data in selected range.</div>}
      </div>
    </section>
  );
}

function ResetRidesCard(){
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
    <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
      <h2 className="font-semibold mb-3">Danger Zone</h2>
      <button onClick={prepare} className="rounded border px-3 py-2 text-sm border-red-400 text-red-700 dark:text-red-300">Reset Ride Data…</button>
      {open && (
        <div className="mt-3 p-3 rounded border bg-white text-black dark:bg-neutral-900 dark:text-white">
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
    </section>
  );
}

