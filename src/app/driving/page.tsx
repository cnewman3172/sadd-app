"use client";
import { useEffect, useRef, useState } from 'react';

type Van = {
  id: string;
  name: string;
  capacity: number;
  status: 'ACTIVE'|'MAINTENANCE'|'OFFLINE';
  activeTcId?: string | null;
};
type Ride = {
  id: string;
  rideCode: number;
  status: 'ASSIGNED'|'EN_ROUTE'|'PICKED_UP'|'DROPPED'|'PENDING'|'CANCELED';
  pickupAddr: string;
  dropAddr: string;
  passengers: number;
};

export default function Driving(){
  const [vans, setVans] = useState<Van[]>([]);
  const [currentVan, setCurrentVan] = useState<Van|null>(null);
  const [tasks, setTasks] = useState<Ride[]>([]);
  const [selected, setSelected] = useState('');
  const [sseStatus, setSseStatus] = useState<'connecting'|'online'|'offline'>('connecting');
  const [userId, setUserId] = useState<string>('');

  async function refreshVans(){
    const v = await fetch('/api/vans').then(r=>r.json());
    setVans(v);
  }
  async function refreshTasks(){
    const r = await fetch('/api/driver/tasks').then(r=>r.json());
    setCurrentVan(r.van);
    setTasks(r.tasks||[]);
  }
  useEffect(()=>{
    fetch('/api/me').then(r=> r.ok ? r.json() : {}).then(d=> setUserId(d?.id || d?.uid || ''));
    refreshVans();
    refreshTasks();
    const es = new EventSource('/api/stream');
    setSseStatus('connecting');
    es.addEventListener('hello', ()=> setSseStatus('online'));
    es.addEventListener('ride:update', ()=> refreshTasks());
    es.addEventListener('vans:update', ()=> { refreshVans(); refreshTasks(); });
    es.onerror = ()=> setSseStatus('offline');
    return ()=>{ es.close(); };
  },[]);

  async function goOnline(){
    if (!selected) return alert('Select a van');
    const res = await fetch('/api/driver/go-online', { method:'POST', body: JSON.stringify({ vanId: selected }) });
    if (res.ok) { setSelected(''); refreshTasks(); startPings(); }
  }
  async function goOffline(){
    const res = await fetch('/api/driver/go-offline', { method:'POST' });
    if (res.ok) { stopPings(); refreshTasks(); }
  }
  async function setStatus(id:string, status:string){
    await fetch(`/api/rides/${id}`, { method:'PUT', body: JSON.stringify({ status }) });
    refreshTasks();
  }

  // location pings when online
  const watchId = useRef<number | null>(null);
  function startPings(){
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    if (watchId.current !== null) return;
    watchId.current = navigator.geolocation.watchPosition((pos)=>{
      const { latitude, longitude } = pos.coords;
      fetch('/api/driver/ping', { method:'POST', body: JSON.stringify({ lat: latitude, lng: longitude }) });
    }, ()=>{}, { enableHighAccuracy:true, maximumAge:5000, timeout:10000 });
  }
  function stopPings(){
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    if (watchId.current !== null){
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Truck Commander <span className="text-sm opacity-70">{sseStatus==='online'?'• Live':sseStatus==='connecting'?'• Connecting':'• Offline'}</span></h1>
      <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20 space-y-2">
        <div className="text-sm">{currentVan ? `Online as ${currentVan.name}` : 'Offline'}</div>
        {!currentVan && (
          <div className="flex gap-2 items-center">
            <select className="border rounded px-2 py-1" value={selected} onChange={(e)=>setSelected(e.target.value)}>
              <option value="">Select van</option>
              {vans
                .filter(v=> (v.activeTcId==null || v.activeTcId===userId))
                .map(v=> <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <button onClick={goOnline} className="rounded px-4 py-2 bg-black text-white">Go Online</button>
          </div>
        )}
        {currentVan && (
          <button onClick={goOffline} className="rounded px-4 py-2 border">Go Offline</button>
        )}
      </section>
      <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
        <h2 className="font-semibold mb-2">Tasks</h2>
        {tasks.length===0 && <div className="text-sm opacity-80">No tasks yet.</div>}
        <div className="space-y-2">
          {tasks.map((t:any)=> (
            <div key={t.id} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">#{t.rideCode}</div>
                <div className="text-xs opacity-70">{t.status}</div>
              </div>
              <div className="text-sm opacity-80">{t.pickupAddr} → {t.dropAddr} · Pax {t.passengers}</div>
              <div className="flex gap-2 mt-2">
                {t.status==='ASSIGNED' && <button onClick={()=>setStatus(t.id,'EN_ROUTE')} className="rounded bg-black text-white px-3 py-1 text-sm">En Route</button>}
                {t.status==='EN_ROUTE' && <button onClick={()=>setStatus(t.id,'PICKED_UP')} className="rounded border px-3 py-1 text-sm">Picked Up</button>}
                {t.status==='PICKED_UP' && <button onClick={()=>setStatus(t.id,'DROPPED')} className="rounded bg-green-600 text-white px-3 py-1 text-sm">Dropped</button>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
