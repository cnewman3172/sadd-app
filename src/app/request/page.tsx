"use client";
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const Map = dynamic(() => import('../../components/Map'), { ssr: false });

export default function RequestPage(){
  const [form, setForm] = useState<any>({ passengers:1 });
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(()=>{ fetch('/api/my-rides?limit=3').then(r=>r.json()).then(setHistory); },[]);

  function useMyLocation(){ navigator.geolocation.getCurrentPosition(async (pos)=>{
    const { latitude, longitude } = pos.coords;
    setForm((f:any)=>({ ...f, pickupLat: latitude, pickupLng: longitude }));
  }); }

  async function submit(e: React.FormEvent){
    e.preventDefault();
    const res = await fetch('/api/rides/request', { method:'POST', body: JSON.stringify(form) });
    const data = await res.json();
    setStatus(data);
  }

  return (
    <div className="grid md:grid-cols-3 gap-6 p-4 max-w-6xl mx-auto">
      <div className="md:col-span-2 space-y-4">
        {!status && (
          <form onSubmit={submit} className="grid gap-3 p-4 rounded-xl bg-white/70 dark:bg-white/10 backdrop-blur border border-white/20">
            <h1 className="text-xl font-semibold">Request a Ride</h1>
            <div className="grid gap-2">
              <label className="text-sm">Pickup</label>
              <div className="flex gap-2">
                <input className="flex-1 p-3 rounded border" placeholder="Address or place" onChange={(e)=>setForm({...form, pickupAddr: e.target.value})} />
                <button type="button" onClick={useMyLocation} className="rounded px-3 border">Use my location</button>
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm">Drop Off</label>
              <input className="p-3 rounded border" placeholder="Address or place" onChange={(e)=>setForm({...form, dropAddr: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={1} className="p-3 rounded border" placeholder="# Passengers" value={form.passengers} onChange={(e)=>setForm({...form, passengers:Number(e.target.value)})} />
              <input className="p-3 rounded border" placeholder="Notes (optional)" onChange={(e)=>setForm({...form, notes:e.target.value})} />
            </div>
            <button className="rounded bg-black text-white py-3">Submit Request</button>
          </form>
        )}
        {status && (
          <div className="p-4 rounded-xl bg-white/70 dark:bg-white/10 backdrop-blur border border-white/20">
            <h2 className="text-lg font-semibold mb-2">Ride Status</h2>
            <p>Ride ID: {status.rideCode}</p>
            <p>Status: {status.status}</p>
          </div>
        )}
        {history.length>0 && (
          <div className="p-4 rounded-xl bg-white/70 dark:bg-white/10 backdrop-blur border border-white/20">
            <h3 className="font-semibold mb-2">Your last 3 rides</h3>
            <ul className="text-sm space-y-1">
              {history.map((r)=> (
                <li key={r.id}>#{r.rideCode} — {r.status} — {new Date(r.requestedAt).toLocaleString()}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <aside className="space-y-4">
        <div className="rounded-xl overflow-hidden border border-white/20">
          <Map height={400} markers={[]} />
        </div>
      </aside>
    </div>
  );
}

