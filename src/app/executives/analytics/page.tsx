"use client";
import { useEffect, useState } from 'react';
import AuditLog from '@/components/admin/AuditLog';

type Summary = { totalUsers:number; totalRides:number; activeRides:number; ridesToday:number; activeVans:number };

export default function AnalyticsPage(){
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  useEffect(()=>{
    (async()=>{
      const s = await fetch('/api/admin/summary', { cache: 'no-store' }).then(r=>r.json());
      setSummary(s);
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

      <section className="space-y-2">
        <h2 className="font-semibold">Recent Activity</h2>
        <AuditLog />
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

