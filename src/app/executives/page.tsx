"use client";
import { useEffect, useState } from 'react';
import type { Ride } from '@/types';
import { showToast } from '@/components/Toast';

export default function ExecutivesDashboard(){
  const [active, setActive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ totalUsers:number; totalRides:number; activeRides:number; ridesToday:number; activeVans:number; lastRides: Ride[] } | null>(null);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoTime, setAutoTime] = useState('22:00');
  const [autoTz, setAutoTz] = useState('America/Anchorage');

  async function load(){
    try{
      const [h, s, conf] = await Promise.all([
        fetch('/api/health', { cache: 'no-store' }).then(r=>r.json()),
        fetch('/api/admin/summary', { cache: 'no-store' }).then(r=>r.json()),
      ),
        fetch('/api/admin/settings', { cache: 'no-store' }).then(r=>r.json()).catch(()=>null),
      ]);
      setActive(Boolean(h.active));
      setSummary(s);
      if (conf){ setAutoEnabled(Boolean(conf.autoDisableEnabled)); setAutoTime(conf.autoDisableTime||'22:00'); setAutoTz(conf.autoDisableTz||'America/Anchorage'); }
    }catch{ setActive(null); }
  }
  useEffect(()=>{ load(); },[]);

  async function toggle(){
    setBusy(true); setError(null);
    try{
      const r = await fetch('/api/admin/toggle-active', { method:'POST' });
      if (!r.ok){ const d = await r.json().catch(()=>({error:'failed'})); throw new Error(d.error||'Toggle failed'); }
      const d = await r.json();
      const on = Boolean(d.active);
      setActive(on);
      showToast(on ? 'SADD is now Active' : 'SADD is now Inactive');
    }catch(e:any){ setError(e.message||'Toggle failed'); }
    finally{ setBusy(false); }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
        <h2 className="font-semibold mb-3">Dashboard</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric title="Total Rides" value={summary?.totalRides?.toString() ?? '—'} />
          <Metric title="Rides Today" value={summary?.ridesToday?.toString() ?? '—'} />
          <Metric title="Active Rides" value={summary?.activeRides?.toString() ?? '—'} />
          <Metric title="Active Vans" value={summary?.activeVans?.toString() ?? '—'} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={toggle} disabled={busy} className={`rounded px-4 py-2 border text-sm ${active ? 'border-green-600 bg-green-600 text-white' : 'border-red-600 bg-red-600 text-white'}`}>
            {busy ? 'Toggling…' : active ? 'Set Inactive' : 'Set Active'}
          </button>
          <span className={`text-sm ${active===null ? 'opacity-80' : active ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            Status: {active===null ? '—' : active ? 'Active' : 'Inactive'}
          </span>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </section>

      <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
        <h3 className="font-semibold mb-2">Recent Rides</h3>
        <div className="rounded-xl border border-white/20 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left opacity-70">
                <th className="py-2 px-2">When</th>
                <th className="px-2">Ride</th>
                <th className="px-2">Rider</th>
                <th className="px-2">Route</th>
                <th className="px-2">Status</th>
                <th className="px-2">Van</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.lastRides||[]).map(r=> (
                <tr key={r.id} className="border-t border-white/20">
                  <td className="py-2 px-2 whitespace-nowrap">{new Date(r.requestedAt).toLocaleString()}</td>
                  <td className="px-2 whitespace-nowrap">#{r.rideCode}</td>
                  <td className="px-2 whitespace-nowrap">{r.rider?.firstName} {r.rider?.lastName}</td>
                  <td className="px-2">{r.pickupAddr} → {r.dropAddr}</td>
                  <td className="px-2 whitespace-nowrap">{r.status}</td>
                  <td className="px-2 whitespace-nowrap">{(r as any).van?.name || '—'}</td>
                </tr>
              ))}
              {(summary?.lastRides?.length ?? 0)===0 && (
                <tr><td className="py-3 px-2 text-sm opacity-70" colSpan={6}>No recent rides.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>


      <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
        <h3 className="font-semibold mb-2">Auto Disable Schedule</h3>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoEnabled} onChange={(e)=> setAutoEnabled(e.target.checked)} /> Enable daily auto-disable
          </label>
          <label className="text-sm">Time
            <input type="time" className="ml-2 p-1 rounded border bg-white/80 dark:bg-neutral-800" value={autoTime} onChange={(e)=> setAutoTime(e.target.value)} />
          </label>
          <label className="text-sm">Timezone
            <select className="ml-2 p-1 rounded border bg-white/80 dark:bg-neutral-800" value={autoTz} onChange={(e)=> setAutoTz(e.target.value)}>
              <option value="America/Anchorage">America/Anchorage</option>
              <option value="America/Adak">America/Adak</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="America/Denver">America/Denver</option>
              <option value="America/Chicago">America/Chicago</option>
              <option value="America/New_York">America/New_York</option>
              <option value="UTC">UTC</option>
            </select>
          </label>
          <button onClick={async()=>{
            setBusy(true); setError(null);
            try{
              const r = await fetch('/api/admin/settings', { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ autoDisableEnabled: autoEnabled, autoDisableTime: autoTime, autoDisableTz: autoTz }) });
              if (!r.ok){ const d = await r.json().catch(()=>({error:'failed'})); throw new Error(d.error||'Save failed'); }
              showToast('Auto-disable settings saved');
            }catch(e:any){ setError(e.message||'Save failed'); }
            finally{ setBusy(false); }
          }} className="rounded border px-3 py-2 text-sm">Save</button>
        </div>
      </section>
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
