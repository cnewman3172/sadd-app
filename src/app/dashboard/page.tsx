"use client";
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
const Map = dynamic(() => import('../../components/Map'), { ssr: false });

type Ride = any;
type Van = any;

export default function Dashboard(){
  const [rides, setRides] = useState<Ride[]>([]);
  const [vans, setVans] = useState<Van[]>([]);

  async function refresh(){
    const [r, v] = await Promise.all([
      fetch('/api/rides?take=100').then(r=>r.json()),
      fetch('/api/vans').then(r=>r.json()),
    ]);
    setRides(r);
    setVans(v);
  }

  useEffect(()=>{ refresh(); const id = setInterval(refresh, 5000); return ()=>clearInterval(id); },[]);
  useEffect(()=>{
    const es = new EventSource('/api/stream');
    es.addEventListener('ride:update', ()=> refresh());
    es.addEventListener('vans:update', ()=> refresh());
    es.addEventListener('vans:location', (e)=>{
      try{
        const d = JSON.parse((e as MessageEvent).data);
        setVans((prev:any[])=> prev.map(v=> v.id===d.id ? { ...v, currentLat:d.lat, currentLng:d.lng } : v));
      }catch{}
    });
    return ()=>{ es.close(); };
  },[]);

  const pending = useMemo(()=> rides.filter((r:Ride)=>r.status==='PENDING'),[rides]);
  const active = useMemo(()=> rides.filter((r:Ride)=>['ASSIGNED','EN_ROUTE','PICKED_UP'].includes(r.status)),[rides]);

  async function setStatus(id:string, status:string, vanId?:string){
    await fetch(`/api/rides/${id}`, { method:'PUT', body: JSON.stringify({ status, vanId }) });
    refresh();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-4">
        <Card title="Live Ops">
          <div className="text-sm space-y-1">
            <div>Active Vans: {vans.length}</div>
            <div>Pickups In Progress: {active.length}</div>
            <div>Pending Requests: {pending.length}</div>
          </div>
        </Card>
        <Card title="Active Fleet">
          <div className="text-sm space-y-2">
            {vans.length===0 && <div className="opacity-80">No vans configured.</div>}
            {vans.map((v:any)=> (
              <div key={v.id} className="flex items-center justify-between">
                <div>{v.name} <span className="opacity-60">({v.capacity})</span></div>
                <div className="text-xs opacity-70">{v.status}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="md:col-span-2 space-y-4">
        <Card title="Incoming Requests">
          <div className="space-y-2">
            {pending.length===0 && <div className="text-sm opacity-80">No pending requests.</div>}
            {pending.map((r:any)=> (
              <div key={r.id} className="rounded border p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">#{r.rideCode} · {r.rider?.firstName} {r.rider?.lastName}</div>
                  <div className="text-xs opacity-70">{new Date(r.requestedAt).toLocaleString()}</div>
                </div>
                <div className="text-sm opacity-80">{r.pickupAddr} → {r.dropAddr}</div>
                <div className="flex gap-2 items-center">
                  <select className="border rounded px-2 py-1 text-sm" id={`van-${r.id}`} defaultValue="">
                    <option value="">Select van</option>
                    {vans.map((v:any)=> <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <button onClick={()=>{
                    const sel = document.getElementById(`van-${r.id}`) as HTMLSelectElement | null;
                    const vanId = sel?.value || undefined;
                    setStatus(r.id, 'ASSIGNED', vanId);
                  }} className="rounded bg-black text-white px-3 py-1 text-sm">Assign</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Live Operations Map">
          <Map height={500} markers={vans.filter((v:any)=>v.currentLat&&v.currentLng).map((v:any)=>({ lat:v.currentLat, lng:v.currentLng, color:'green' }))} />
        </Card>
      </div>
    </div>
  );
}

function Card({title, children}:{title:string, children:any}){
  return (
    <section className="rounded-2xl p-4 bg-white/70 dark:bg-white/10 backdrop-blur border border-white/20">
      <h2 className="font-semibold mb-2">{title}</h2>
      {children}
    </section>
  );
}
