"use client";
import { useEffect, useState } from 'react';
import type { Ride } from '@/types';

export default function ExecutivesDashboard(){
  const [active, setActive] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<{ totalUsers:number; totalRides:number; activeRides:number; ridesToday:number; activeVans:number; lastRides: Ride[] } | null>(null);

  async function load(){
    try{
      const [h, s] = await Promise.all([
        fetch('/api/health', { cache: 'no-store' }).then(r=>r.json()),
        fetch('/api/admin/summary', { cache: 'no-store' }).then(r=>r.json()),
      ]);
      setActive(Boolean(h.active));
      setSummary(s);
    }catch{ setActive(null); }
  }
  useEffect(()=>{ load(); },[]);

  return (
    <div className="grid gap-6">
      <section className="glass rounded-[32px] border border-white/20 p-5 shadow-lg dark:border-white/10">
        <h2 className="font-semibold mb-3">Dashboard</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric title="Total Rides" value={summary?.totalRides?.toString() ?? '—'} />
          <Metric title="Rides Today" value={summary?.ridesToday?.toString() ?? '—'} />
          <Metric title="Active Rides" value={summary?.activeRides?.toString() ?? '—'} />
          <Metric title="Active Fleet" value={summary?.activeVans?.toString() ?? '—'} />
        </div>
        <div className={`mt-4 text-sm font-semibold ${active===null ? 'opacity-70' : active ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          Status: {active===null ? '—' : active ? 'Active' : 'Inactive'}
        </div>
      </section>

      {/* Recent Rides section removed per request */}
    </div>
  );
}

function Metric({title, value}:{title:string; value:string}){
  return (
    <div className="glass rounded-[24px] border border-white/20 p-4 shadow-md dark:border-white/10">
      <div className="text-xs opacity-70">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
