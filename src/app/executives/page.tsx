"use client";
import { useEffect, useState } from 'react';

export default function Executives(){
  const [active, setActive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(){
    try{
      const r = await fetch('/api/health', { cache: 'no-store' });
      const d = await r.json();
      setActive(Boolean(d.active));
    }catch{ setActive(null); }
  }
  useEffect(()=>{ load(); },[]);

  async function toggle(){
    setBusy(true); setError(null);
    try{
      const r = await fetch('/api/admin/toggle-active', { method:'POST' });
      if (!r.ok){ const d = await r.json().catch(()=>({error:'failed'})); throw new Error(d.error||'Toggle failed'); }
      const d = await r.json();
      setActive(Boolean(d.active));
    }catch(e:any){ setError(e.message||'Toggle failed'); }
    finally{ setBusy(false); }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto grid gap-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <div className="grid md:grid-cols-4 gap-4">
        <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20 md:col-span-3">
          <h2 className="font-semibold mb-3">Dashboard</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric title="Total Pickups" value="0" />
            <Metric title="Avg Pickup" value="—" />
            <Metric title="Avg Dropoff" value="—" />
            <Metric title="No-Show Rate" value="—" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={toggle} disabled={busy} className="rounded px-4 py-2 border">
              {busy ? 'Toggling…' : 'Toggle SADD Active'}
            </button>
            <span className="text-sm opacity-80">Status: {active===null ? '—' : active ? 'Active' : 'Inactive'}</span>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </section>
        <aside className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
          <nav className="grid gap-2 text-sm">
            <a className="underline" href="#dashboard">Dashboard</a>
            <a className="underline" href="#analytics">Analytics</a>
            <a className="underline" href="#users">Users</a>
            <a className="underline" href="/executives/vans">Fleet</a>
            <a className="underline" href="/executives/audit">Audit Log</a>
          </nav>
        </aside>
      </div>
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
