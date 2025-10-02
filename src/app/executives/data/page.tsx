"use client";
import { useEffect, useState } from 'react';

export default function DataPage(){
  return (
    <div className="grid gap-6">
      <ExportRides />
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
    <section className="glass rounded-[32px] border border-white/20 p-5 shadow-lg dark:border-white/10">
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
    <section className="glass rounded-[32px] border border-white/20 p-5 shadow-lg dark:border-white/10">
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
