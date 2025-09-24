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
  const [busyKey, setBusyKey] = useState<string>('');

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

  async function save(changes: Partial<Detail> & {
    trainingSafety?: boolean; trainingDriver?: boolean; trainingTc?: boolean; trainingDispatcher?: boolean;
  }){
    if (!id || !d) return;
    setBusyKey(Object.keys(changes).join(','));
    try{
      const res = await fetch(`/api/admin/users/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(changes) });
      if (!res.ok){ const e = await res.json().catch(()=>({error:'failed'})); throw new Error(e.error||'Save failed'); }
      // Optimistically update local state
      setD(prev => prev ? ({
        ...prev,
        vmisRegistered: changes.vmisRegistered ?? prev.vmisRegistered,
        volunteerAgreement: changes.volunteerAgreement ?? prev.volunteerAgreement,
        saddSopRead: changes.saddSopRead ?? prev.saddSopRead,
        checkRide: changes.checkRide ?? prev.checkRide,
        trainingSafetyAt: changes.trainingSafety!==undefined ? (changes.trainingSafety ? new Date().toISOString() : null) : prev.trainingSafetyAt,
        trainingDriverAt: changes.trainingDriver!==undefined ? (changes.trainingDriver ? new Date().toISOString() : null) : prev.trainingDriverAt,
        trainingTcAt: changes.trainingTc!==undefined ? (changes.trainingTc ? new Date().toISOString() : null) : prev.trainingTcAt,
        trainingDispatcherAt: changes.trainingDispatcher!==undefined ? (changes.trainingDispatcher ? new Date().toISOString() : null) : prev.trainingDispatcherAt,
      }) : prev);
    }catch(e:any){ setError(e.message||'Save failed'); }
    finally{ setBusyKey(''); }
  }

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
            <ul className="grid sm:grid-cols-2 gap-3">
              <li className="flex items-center justify-between gap-2">
                <span>VMIS Registered</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={d.vmisRegistered} onChange={(e)=> save({ vmisRegistered: e.target.checked })} />
                  <span className="opacity-70">{busyKey.includes('vmisRegistered') ? 'Saving…' : d.vmisRegistered ? 'Yes' : 'No'}</span>
                </label>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Volunteer Agreement Signed</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={d.volunteerAgreement} onChange={(e)=> save({ volunteerAgreement: e.target.checked })} />
                  <span className="opacity-70">{busyKey.includes('volunteerAgreement') ? 'Saving…' : d.volunteerAgreement ? 'Yes' : 'No'}</span>
                </label>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>SADD SOP Read</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={d.saddSopRead} onChange={(e)=> save({ saddSopRead: e.target.checked })} />
                  <span className="opacity-70">{busyKey.includes('saddSopRead') ? 'Saving…' : d.saddSopRead ? 'Yes' : 'No'}</span>
                </label>
              </li>
            </ul>
          </div>

          {/* Online Training */}
          <div className="rounded-lg border p-3 bg-white/60 dark:bg-white/5">
            <div className="font-medium mb-2">Online Training</div>
            <ul className="grid sm:grid-cols-2 gap-3">
              <li className="flex items-center justify-between gap-2">
                <span>Safety</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!d.trainingSafetyAt} onChange={(e)=> save({ trainingSafety: e.target.checked })} />
                  <span className="opacity-70">{busyKey.includes('trainingSafety') ? 'Saving…' : !!d.trainingSafetyAt ? 'Complete' : 'Not Complete'}</span>
                </label>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Driver</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!d.trainingDriverAt} onChange={(e)=> save({ trainingDriver: e.target.checked })} />
                  <span className="opacity-70">{busyKey.includes('trainingDriver') ? 'Saving…' : !!d.trainingDriverAt ? 'Complete' : 'Not Complete'}</span>
                </label>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Check Ride</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!d.checkRide} onChange={(e)=> save({ checkRide: e.target.checked })} />
                  <span className="opacity-70">{busyKey.includes('checkRide') ? 'Saving…' : !!d.checkRide ? 'Complete' : 'Not Complete'}</span>
                </label>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Truck Commander</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!d.trainingTcAt} onChange={(e)=> save({ trainingTc: e.target.checked })} />
                  <span className="opacity-70">{busyKey.includes('trainingTc') ? 'Saving…' : !!d.trainingTcAt ? 'Complete' : 'Not Complete'}</span>
                </label>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Dispatcher</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!d.trainingDispatcherAt} onChange={(e)=> save({ trainingDispatcher: e.target.checked })} />
                  <span className="opacity-70">{busyKey.includes('trainingDispatcher') ? 'Saving…' : !!d.trainingDispatcherAt ? 'Complete' : 'Not Complete'}</span>
                </label>
              </li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
