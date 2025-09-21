"use client";
import { useEffect, useRef, useState } from 'react';
import { showToast } from '@/components/Toast';
import type { Van, Ride } from '@/types';
import AddressInput from '@/components/AddressInput';

export default function Driving(){
  const [vans, setVans] = useState<Van[]>([]);
  const [currentVan, setCurrentVan] = useState<Van|null>(null);
  const [tasks, setTasks] = useState<Ride[]>([]);
  const [selected, setSelected] = useState('');
  const [sseStatus, setSseStatus] = useState<'connecting'|'online'|'offline'>('connecting');
  const [userId, setUserId] = useState<string>('');
  const [wakeSupported, setWakeSupported] = useState(false);
  const [wakeOn, setWakeOn] = useState(true);
  const [walkOpen, setWalkOpen] = useState(false);
  const [walkTaskId, setWalkTaskId] = useState<string>('');
  const [walkForm, setWalkForm] = useState<any>({ name:'', phone:'', dropAddr:'', dropLat: undefined as number|undefined, dropLng: undefined as number|undefined });

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
  useEffect(()=>{ try{ setWakeSupported('wakeLock' in navigator); }catch{ setWakeSupported(false); } },[]);

  async function goOnline(){
    if (!selected) return alert('Select a van');
    if (!navigator.geolocation){ showToast('Location required to go online'); return; }
    navigator.geolocation.getCurrentPosition(async(pos)=>{
      const { latitude, longitude } = pos.coords;
      const res = await fetch('/api/driver/go-online', { method:'POST', body: JSON.stringify({ vanId: selected, lat: latitude, lng: longitude }) });
      if (res.ok) { setSelected(''); refreshTasks(); startPings(); }
      else {
        const d = await res.json().catch(()=>({error:'Failed to go online'}));
        showToast(d.error || 'Failed to go online');
      }
    }, ()=>{
      showToast('Please allow location to go online.');
    }, { enableHighAccuracy:true, maximumAge:10000, timeout:15000 });
  }
  async function goOffline(){
    const res = await fetch('/api/driver/go-offline', { method:'POST' });
    if (res.ok) { stopPings(); refreshTasks(); }
  }
  async function setStatus(id:string, status:string){
    if (!confirm(`Mark #${id.slice(0,8)} as ${status}?`)) return;
    await fetch(`/api/rides/${id}`, { method:'PUT', body: JSON.stringify({ status }) });
    refreshTasks();
  }

  // location pings every 5 seconds when online
  const pingTimer = useRef<number | null>(null);
  const wakeRef = useRef<any>(null);
  function sendSinglePing(){
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    try{
      navigator.geolocation.getCurrentPosition((pos)=>{
        const { latitude, longitude } = pos.coords;
        fetch('/api/driver/ping', { method:'POST', body: JSON.stringify({ lat: latitude, lng: longitude }) });
      });
    }catch{}
  }
  async function requestWake(){
    if (!wakeOn) return;
    try{
      // @ts-ignore
      if ('wakeLock' in navigator && !wakeRef.current){
        // @ts-ignore
        wakeRef.current = await (navigator as any).wakeLock.request('screen');
        wakeRef.current.addEventListener?.('release', ()=>{ /* noop */ });
      }
    }catch{}
  }
  function releaseWake(){
    try{ if (wakeRef.current){ wakeRef.current.release?.(); wakeRef.current = null; } }catch{}
  }
  function startPings(){
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    if (pingTimer.current !== null) return;
    requestWake();
    const sendOnce = () => {
      try{
        navigator.geolocation.getCurrentPosition((pos)=>{
          const { latitude, longitude } = pos.coords;
          fetch('/api/driver/ping', { method:'POST', body: JSON.stringify({ lat: latitude, lng: longitude }) });
        });
      }catch{}
    };
    sendOnce();
    pingTimer.current = window.setInterval(sendOnce, 5000);
  }
  function stopPings(){
    if (pingTimer.current !== null){
      window.clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
    releaseWake();
  }

  // If already online when opening the page, start pings and force an immediate location update
  useEffect(()=>{
    if (currentVan){ startPings(); sendSinglePing(); }
  }, [currentVan?.id]);

  // When tab becomes visible again, force a one-off ping to refresh location
  useEffect(()=>{
    const onVis = ()=>{ if (document.visibilityState==='visible' && currentVan){ sendSinglePing(); } };
    document.addEventListener('visibilitychange', onVis);
    return ()=> document.removeEventListener('visibilitychange', onVis);
  }, [currentVan?.id]);

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
          <div className="flex items-center gap-3">
            <button onClick={goOffline} className="rounded px-4 py-2 border">Go Offline</button>
            {wakeSupported && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={wakeOn} onChange={(e)=>{ setWakeOn(e.target.checked); if (e.target.checked) requestWake(); else releaseWake(); }} />
                Keep screen awake
              </label>
            )}
          </div>
        )}
      </section>
      <section className="rounded-xl p-3 bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border border-amber-200 dark:border-amber-700">
        <div className="text-sm">
          Keep this page open while you are Online so your location updates reliably every 5 seconds. Turning on “Keep screen awake” can help prevent the device from sleeping.
        </div>
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
              <div className="text-sm opacity-90">
                Rider: {(t.rider?.firstName||'').toString()} {(t.rider?.lastName||'').toString()}
              </div>
              <div className="text-sm opacity-80">{t.pickupAddr} → {t.dropAddr} · Pax {t.passengers}</div>
              <div className="flex flex-wrap gap-2 text-xs mt-1">
                {(t.status==='ASSIGNED' || t.status==='EN_ROUTE') && (
                  <a className="rounded border px-2 py-1" target="_blank" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((t as any).pickupLat?`${(t as any).pickupLat},${(t as any).pickupLng}`:t.pickupAddr)}`}>
                    Directions to Pickup
                  </a>
                )}
                {t.status==='PICKED_UP' && (
                  <a className="rounded border px-2 py-1" target="_blank" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((t as any).dropLat?`${(t as any).dropLat},${(t as any).dropLng}`:t.dropAddr)}`}>
                    Directions to Drop
                  </a>
                )}
                {(t.status==='ASSIGNED' || t.status==='EN_ROUTE') && t.rider?.phone && (
                  <a className="rounded border px-2 py-1" href={`tel:${t.rider.phone}`}>
                    Call Rider
                  </a>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                {t.status==='ASSIGNED' && <button onClick={()=>setStatus(t.id,'EN_ROUTE')} className="rounded bg-black text-white px-3 py-1 text-sm">En Route</button>}
                {t.status==='EN_ROUTE' && <button onClick={()=>setStatus(t.id,'PICKED_UP')} className="rounded border px-3 py-1 text-sm">Picked Up</button>}
                {t.status==='PICKED_UP' && <button onClick={()=>setStatus(t.id,'DROPPED')} className="rounded bg-green-600 text-white px-3 py-1 text-sm">Dropped</button>}
                {(t.status==='ASSIGNED' || t.status==='EN_ROUTE') && (
                  <button onClick={async()=>{ if (!confirm(`Mark #${t.rideCode} as No Show and cancel?`)) return; await fetch(`/api/rides/${t.id}`, { method:'PUT', body: JSON.stringify({ status:'CANCELED', notes:'No Show' }) }); refreshTasks(); }} className="rounded border px-3 py-1 text-sm border-red-500 text-red-600">No Show</button>
                )}
                <button onClick={()=>{ setWalkTaskId(t.id); setWalkForm({ name:'', phone:'', dropAddr:'', dropLat: undefined, dropLng: undefined }); setWalkOpen(true); }} className="rounded border px-3 py-1 text-sm">Walk On…</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {walkOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-900 border border-white/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Add Walk-On Passenger</h3>
              <button onClick={()=> setWalkOpen(false)} aria-label="Close">✕</button>
            </div>
            {(() => {
              const t = tasks.find(x=> x.id===walkTaskId);
              return (
                <div className="grid gap-2">
                  <div className="text-xs opacity-70">Pickup: {t?.pickupAddr || '—'}</div>
                  <input className="p-2 rounded border text-sm" placeholder="Name" value={walkForm.name} onChange={(e)=> setWalkForm((f:any)=> ({ ...f, name: e.target.value }))} />
                  <input className="p-2 rounded border text-sm" placeholder="Cell Number" value={walkForm.phone} onChange={(e)=> setWalkForm((f:any)=> ({ ...f, phone: e.target.value }))} />
                  <AddressInput label="Drop Off" value={walkForm.dropAddr} onChange={(t)=> setWalkForm((f:any)=> ({ ...f, dropAddr: t }))} onSelect={(o)=> setWalkForm((f:any)=> ({ ...f, dropAddr: o.label, dropLat: o.lat, dropLng: o.lon }))} />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={()=> setWalkOpen(false)} className="rounded border px-3 py-1 text-sm">Cancel</button>
                    <button onClick={async()=>{
                      try{
                        const res = await fetch('/api/driver/walk-on', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ...walkForm, taskId: walkTaskId }) });
                        if (!res.ok){ const d = await res.json().catch(()=>({error:'Failed'})); throw new Error(d.error||'Failed'); }
                        showToast('Walk-on added'); setWalkOpen(false); setWalkTaskId(''); setWalkForm({ name:'', phone:'', dropAddr:'' }); refreshTasks();
                      }catch(e:any){ showToast(e.message||'Failed'); }
                    }} className="rounded bg-black text-white px-3 py-1 text-sm">Add</button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
