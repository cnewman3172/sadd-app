"use client";
import { useEffect, useState } from 'react';
import type { Ride, Van, User } from '@/types';

export default function Executives(){
  const [active, setActive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ totalUsers:number; totalRides:number; activeRides:number; ridesToday:number; activeVans:number; lastRides: Ride[] } | null>(null);
  const [users, setUsers] = useState<Array<{ id:string; email:string; firstName:string; lastName:string; role:string; createdAt:string }>>([]);
  const [q, setQ] = useState('');

  async function load(){
    try{
      const [h, s, u] = await Promise.all([
        fetch('/api/health', { cache: 'no-store' }).then(r=>r.json()),
        fetch('/api/admin/summary', { cache: 'no-store' }).then(r=>r.json()),
        fetch('/api/admin/users').then(r=>r.json())
      ]);
      setActive(Boolean(h.active));
      setSummary(s);
      setUsers(u);
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
            <Metric title="Total Rides" value={summary?.totalRides?.toString() ?? '—'} />
            <Metric title="Rides Today" value={summary?.ridesToday?.toString() ?? '—'} />
            <Metric title="Active Rides" value={summary?.activeRides?.toString() ?? '—'} />
            <Metric title="Active Vans" value={summary?.activeVans?.toString() ?? '—'} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={toggle} disabled={busy} className="rounded px-4 py-2 border">
              {busy ? 'Toggling…' : 'Toggle SADD Active'}
            </button>
            <span className="text-sm opacity-80">Status: {active===null ? '—' : active ? 'Active' : 'Inactive'}</span>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
          <div className="mt-6">
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
                </tbody>
              </table>
            </div>
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

      <section id="users" className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Users</h2>
          <input value={q} onChange={(e)=> setQ(e.target.value)} onKeyDown={async(e)=>{ if(e.key==='Enter'){ const d = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`).then(r=>r.json()); setUsers(d); } }} placeholder="Search email or name" className="p-2 rounded border bg-white/80 text-sm" />
        </div>
        <div className="rounded-xl border border-white/20 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left opacity-70">
                <th className="py-2 px-2">Email</th>
                <th className="px-2">Name</th>
                <th className="px-2">Role</th>
                <th className="px-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u=> (
                <tr key={u.id} className="border-t border-white/20">
                  <td className="py-2 px-2 whitespace-nowrap">{u.email}</td>
                  <td className="px-2 whitespace-nowrap">{u.firstName} {u.lastName}</td>
                  <td className="px-2">
                    <select defaultValue={u.role} className="p-1 rounded border bg-white/80" onChange={async(e)=>{
                      const role = e.target.value;
                      const res = await fetch(`/api/admin/users/${u.id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ role }) });
                      if (!res.ok) { alert('Update failed'); e.target.value = u.role; return; }
                      setUsers(prev=> prev.map(x=> x.id===u.id ? { ...x, role } : x));
                    }}>
                      <option value="ADMIN">ADMIN</option>
                      <option value="COORDINATOR">COORDINATOR</option>
                      <option value="TC">TC</option>
                      <option value="RIDER">RIDER</option>
                    </select>
                  </td>
                  <td className="px-2 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
