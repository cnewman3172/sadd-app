"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Detail = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  vmisRegistered: boolean;
  volunteerAgreement: boolean;
  saddSopRead: boolean;
  trainingSafetyAt: string | null;
  trainingDriverAt: string | null;
  trainingTcAt: string | null;
  trainingDispatcherAt: string | null;
  checkRide: boolean;
};

function Badge({ok}:{ok:boolean}){
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ok? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300'}`}>{ok? 'Complete' : 'Not Complete'}</span>;
}

export default function TrainingDetail({ params }: { params: Promise<{ id: string }> }){
  const [id, setId] = useState<string>('');
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(()=>{ params.then(p=> setId(p.id)); },[params]);

  useEffect(()=>{
    if (!id) return;
    (async()=>{
      setLoading(true); setError(null);
      try{
        const res = await fetch(`/api/admin/users/${id}`, { cache:'no-store' });
        if (!res.ok){ const e = await res.json().catch(()=>({error:'failed'})); throw new Error(e.error||'failed'); }
        const data = await res.json();
        setD(data);
      }catch(e:any){ setError(e.message||'Failed'); }
      finally{ setLoading(false); }
    })();
  },[id]);

  return (
    <section className="p-4 rounded-xl glass border grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{d ? `${d.firstName} ${d.lastName}` : 'User'}</h1>
          {d && <div className="text-xs opacity-70">{d.email} • {d.role}</div>}
        </div>
        <Link href="/executives/training" className="rounded border px-3 py-2 text-sm">Back</Link>
      </div>

      {loading && <div className="text-sm opacity-70">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {d && (
        <div className="grid gap-4">
          {/* Prerequisites */}
          <div className="rounded-lg border p-3 bg-white/60 dark:bg-white/5">
            <div className="font-medium mb-2">Prerequisites</div>
            <ul className="grid sm:grid-cols-2 gap-2">
              <li className="flex items-center justify-between gap-2"><span>VMIS Registered</span><Badge ok={d.vmisRegistered} /></li>
              <li className="flex items-center justify-between gap-2"><span>Volunteer Agreement Signed</span><Badge ok={d.volunteerAgreement} /></li>
              <li className="flex items-center justify-between gap-2"><span>SADD SOP Read</span><Badge ok={d.saddSopRead} /></li>
            </ul>
          </div>

          {/* Online Training */}
          <div className="rounded-lg border p-3 bg-white/60 dark:bg-white/5">
            <div className="font-medium mb-2">Online Training</div>
            <ul className="grid sm:grid-cols-2 gap-2">
              <li className="flex items-center justify-between gap-2"><span>Safety</span><Badge ok={!!d.trainingSafetyAt} /></li>
              <li className="flex items-center justify-between gap-2"><span>Driver</span><Badge ok={!!d.trainingDriverAt} /></li>
              <li className="flex items-center justify-between gap-2"><span>Check Ride</span><Badge ok={!!d.checkRide} /></li>
              <li className="flex items-center justify-between gap-2"><span>Truck Commander</span><Badge ok={!!d.trainingTcAt} /></li>
              <li className="flex items-center justify-between gap-2"><span>Dispatcher</span><Badge ok={!!d.trainingDispatcherAt} /></li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

