"use client";
import { useEffect, useRef, useState } from 'react';
import { showToast } from '@/components/Toast';
import type { Van, Ride, TransferRequest } from '@/types';
import AddressInput from '@/components/AddressInput';

const alaskaDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Anchorage',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
});

function formatAlaskaDateTime(value: string){
  try{
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return alaskaDateTimeFormatter.format(date);
  }catch{
    return value;
  }
}

export default function DrivingClient(){
  const [vans, setVans] = useState<Van[]>([]);
  const [currentVan, setCurrentVan] = useState<Van|null>(null);
  const [tasks, setTasks] = useState<Ride[]>([]);
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [sseStatus, setSseStatus] = useState<'connecting'|'online'|'offline'>('connecting');
  const [userId, setUserId] = useState<string>('');
  const [wakeSupported, setWakeSupported] = useState(false);
  const [wakeOn, setWakeOn] = useState(true);
  const [walkOpen, setWalkOpen] = useState(false);
  const [walkTaskId, setWalkTaskId] = useState<string>('');
  const [walkForm, setWalkForm] = useState<any>({ riderId:'', name:'', phone:'', pickupAddr:'', pickupLat: undefined as number|undefined, pickupLng: undefined as number|undefined, dropAddr:'', dropLat: undefined as number|undefined, dropLng: undefined as number|undefined });
  const [walkSelRider, setWalkSelRider] = useState<any|null>(null);
  const [walkNameOpts, setWalkNameOpts] = useState<any[]>([]);
  const [walkNameOpen, setWalkNameOpen] = useState(false);
  const [transferBusy, setTransferBusy] = useState<string|null>(null);

  async function refreshVans(){
    const v = await fetch('/api/vans', { credentials:'include' }).then(r=>r.json());
    setVans(v);
  }

  // Inline rider lookup bound to the Name input (Walk-On)
  useEffect(()=>{
    const t = setTimeout(async()=>{
      const q = String(walkForm.name||'').trim();
      if (q.length < 2){ setWalkNameOpts([]); setWalkNameOpen(false); return; }
      try{ const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`, { cache:'no-store' }); const d = await r.json(); setWalkNameOpts(d||[]); setWalkNameOpen(true); }catch{}
    }, 250);
    return ()=> clearTimeout(t);
  }, [walkForm.name]);
  async function refreshTasks(){
    const r = await fetch('/api/driver/tasks', { credentials:'include' }).then(r=>r.json());
    setCurrentVan(r.van);
    setTasks(r.tasks||[]);
  }
  async function refreshTransfers(){
    try{
      const r = await fetch('/api/driver/transfers', { cache:'no-store', credentials:'include' });
      if (!r.ok) return;
      const d = await r.json();
      setTransfers(Array.isArray(d?.requests) ? d.requests : []);
    }catch{}
  }
  useEffect(()=>{
    fetch('/api/me', { credentials:'include' })
      .then(r=> r.ok ? r.json() : null)
      .then((d: any)=> setUserId(d?.id || d?.uid || ''));
    refreshVans();
    refreshTasks();
    refreshTransfers();
    const es = new EventSource('/api/stream');
    setSseStatus('connecting');
    es.addEventListener('hello', ()=> setSseStatus('online'));
    es.addEventListener('ride:update', ()=> refreshTasks());
    es.addEventListener('vans:update', ()=> { refreshVans(); refreshTasks(); refreshTransfers(); });
    es.addEventListener('transfer:update', ()=> { refreshTransfers(); refreshTasks(); });
    es.onerror = ()=> setSseStatus('offline');
    return ()=>{ es.close(); };
  },[]);
  useEffect(()=>{ try{ setWakeSupported('wakeLock' in navigator); }catch{ setWakeSupported(false); } },[]);

  async function goOnline(targetVanId: string){
    if (!targetVanId) return showToast('Select a van');
    // Require notifications permission and push subscription
    const ok = await ensureNotifications();
    if (!ok){ showToast('Please allow notifications to go online.'); return; }
    if (!navigator.geolocation){ showToast('Location required to go online'); return; }
    navigator.geolocation.getCurrentPosition(async(pos)=>{
      const { latitude, longitude } = pos.coords;
      const res = await fetch('/api/driver/go-online', { method:'POST', credentials:'include', body: JSON.stringify({ vanId: targetVanId, lat: latitude, lng: longitude }) });
      if (res.ok) { refreshTasks(); refreshTransfers(); startPings(); }
      else {
        const d = await res.json().catch(()=>({error:'Failed to go online'}));
        showToast(d.error || 'Failed to go online');
      }
    }, ()=>{
      showToast('Please allow location to go online.');
    }, { enableHighAccuracy:true, maximumAge:10000, timeout:15000 });
  }
  async function goOffline(){
    const res = await fetch('/api/driver/go-offline', { method:'POST', credentials:'include' });
    if (res.ok) { stopPings(); refreshTasks(); refreshTransfers(); }
    else {
      const d = await res.json().catch(()=>({ error:'Unable to go offline' }));
      showToast(d.error || 'Unable to go offline');
    }
  }
  async function requestTransfer(vanId: string){
    setTransferBusy(`req:${vanId}`);
    try{
      const res = await fetch('/api/driver/transfers', { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'include', body: JSON.stringify({ vanId }) });
      if (!res.ok){
        const d = await res.json().catch(()=>({ error:'Unable to request transfer' }));
        showToast(d.error || 'Unable to request transfer');
        return;
      }
      showToast('Transfer request sent');
      await refreshTransfers();
    }finally{
      setTransferBusy(null);
    }
  }
  async function respondTransfer(id: string, action: 'ACCEPT'|'DECLINE'|'CANCEL'){
    setTransferBusy(`${id}:${action}`);
    try{
      const res = await fetch(`/api/driver/transfers/${id}`, { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'include', body: JSON.stringify({ action }) });
      if (!res.ok){
        const d = await res.json().catch(()=>({ error:'Unable to update transfer' }));
        showToast(d.error || 'Unable to update transfer');
        return;
      }
      if (action === 'ACCEPT') showToast('Transfer accepted');
      if (action === 'DECLINE') showToast('Transfer declined');
      if (action === 'CANCEL') showToast('Transfer cancelled');
      await refreshTransfers();
      await refreshTasks();
      await refreshVans();
    }finally{
      setTransferBusy(null);
    }
  }
  async function setStatus(id:string, status:string){
    if (!confirm(`Mark #${id.slice(0,8)} as ${status}?`)) return;
    await fetch(`/api/rides/${id}`, { method:'PUT', credentials:'include', body: JSON.stringify({ status }) });
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
        fetch('/api/driver/ping', { method:'POST', credentials:'include', body: JSON.stringify({ lat: latitude, lng: longitude }) });
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
          fetch('/api/driver/ping', { method:'POST', credentials:'include', body: JSON.stringify({ lat: latitude, lng: longitude }) });
        });
      }catch{}
    };
    sendOnce();
    pingTimer.current = window.setInterval(sendOnce, 5000);
  }

  async function ensureNotifications(){
    try{
      if (typeof window === 'undefined') return false;
      if (!('Notification' in window)) return false;
      let perm = Notification.permission;
      if (perm === 'default'){
        perm = await Notification.requestPermission();
      }
      if (perm !== 'granted') return false;
      // Ensure subscription exists
      const vapid = await fetch('/api/push/key', { cache:'no-store' }).then(r=>r.json()).catch(()=>null);
      const pk = vapid?.publicKey || '';
      if (!pk) return true; // treat as soft-ok if push not configured
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub){
        const converted = urlBase64ToUint8Array(pk);
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: converted });
        await fetch('/api/push/subscribe', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ subscription: sub }) });
      }
      return true;
    }catch{ return false; }
  }

  function urlBase64ToUint8Array(base64String: string){
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
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

  const currentVanId = currentVan?.id || null;
  const youAreOnline = Boolean(currentVanId);
  let visibleVans: Van[] = youAreOnline
    ? vans.filter(v=> v.id === currentVanId || v.activeTcId === userId)
    : vans;
  if (youAreOnline && currentVan && !visibleVans.some(v=> v.id === currentVan.id)){
    visibleVans = [...visibleVans, currentVan];
  }

  const formatTcName = (v: Van) => {
    if (!v.activeTc) return '';
    const name = [v.activeTc.firstName, v.activeTc.lastName].filter(Boolean).join(' ').trim();
    return name || v.activeTc.email || '';
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Truck Commander <span className="text-sm opacity-70">{sseStatus==='online'?'• Live':sseStatus==='connecting'?'• Connecting':'• Offline'}</span></h1>
      <section className="glass rounded-[32px] border border-white/20 p-5 shadow-lg dark:border-white/10">
        <h2 className="mb-3 font-semibold">Fleet</h2>
        <div className="space-y-2">
          {visibleVans.length===0 && <div className="text-sm opacity-70">No vans configured.</div>}
          {visibleVans.map((v)=>{
            const youAreOn = currentVanId === v.id;
            const ownedByYou = v.activeTcId === userId;
            const available = !v.activeTcId;
            const outgoing = transfers.find(t=> t.status==='PENDING' && t.toTcId === userId && t.vanId === v.id);
            const activeTcName = formatTcName(v);
            let statusLabel = '';
            if (youAreOn) statusLabel = 'You are online';
            else if (ownedByYou) statusLabel = 'Assigned to you';
            else if (v.activeTcId) statusLabel = activeTcName ? `In use by ${activeTcName}` : 'In use';
            else statusLabel = 'Available';
            return (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/20 px-3 py-2 dark:border-white/10">
                <div>
                  <div className="font-medium">{v.name}</div>
                  <div className="text-xs opacity-70">Capacity {v.capacity || 8} · Status {v.status} · {statusLabel}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {youAreOn ? (
                    <>
                      <button onClick={goOffline} className="rounded border px-3 py-1 text-xs font-semibold">Go Offline</button>
                      {wakeSupported && (
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={wakeOn} onChange={(e)=>{ setWakeOn(e.target.checked); if (e.target.checked) requestWake(); else releaseWake(); }} />
                          Keep screen awake
                        </label>
                      )}
                    </>
                  ) : (
                    !youAreOnline && (
                      (available || ownedByYou) ? (
                        <button
                          onClick={()=> goOnline(v.id)}
                          className="rounded border px-3 py-1 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                        >
                          {ownedByYou ? 'Resume Van' : 'Take Over'}
                        </button>
                      ) : outgoing ? (
                        <button
                          onClick={()=> respondTransfer(outgoing.id, 'CANCEL')}
                          disabled={transferBusy === `${outgoing.id}:CANCEL`}
                          className="rounded border px-3 py-1 text-xs"
                        >
                          Cancel Request
                        </button>
                      ) : (
                        <button
                          onClick={()=> requestTransfer(v.id)}
                          disabled={transferBusy === `req:${v.id}`}
                          className="rounded border px-3 py-1 text-xs"
                        >
                          Request Transfer
                        </button>
                      )
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {(() => {
        const incoming = transfers.filter(t=> t.status==='PENDING' && t.fromTcId === userId);
        const outgoing = transfers.filter(t=> t.status==='PENDING' && t.toTcId === userId);
        if (incoming.length===0 && outgoing.length===0) return null;
        return (
          <section className="glass space-y-3 rounded-[32px] border border-white/20 p-5 shadow-lg dark:border-white/10">
            <div className="font-semibold">Transfer Requests</div>
            {incoming.length>0 && (
              <div className="space-y-2">
                <div className="text-sm opacity-70">Pending handoff requests for your van</div>
                {incoming.map(t=>{
                  const created = formatAlaskaDateTime(t.createdAt);
                  return (
                    <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/20 px-3 py-2 text-sm dark:border-white/10">
                      <div>
                        <div className="font-medium">{t.toTcName || 'Truck Commander'}</div>
                        <div className="text-xs opacity-60">Requested {created}</div>
                        {t.note && <div className="mt-1 text-xs opacity-80">Note: {t.note}</div>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={()=> respondTransfer(t.id, 'DECLINE')}
                          disabled={transferBusy === `${t.id}:DECLINE`}
                          className="rounded border px-3 py-1 text-xs"
                        >
                          Decline
                        </button>
                        <button
                          onClick={()=> respondTransfer(t.id, 'ACCEPT')}
                          disabled={transferBusy === `${t.id}:ACCEPT`}
                          className="rounded bg-black px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-black"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {outgoing.length>0 && (
              <div className="space-y-2">
                <div className="text-sm opacity-70">Requests you have sent</div>
                {outgoing.map(t=>{
                  const created = formatAlaskaDateTime(t.createdAt);
                  return (
                    <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/20 px-3 py-2 text-sm dark:border-white/10">
                      <div>
                        <div className="font-medium">{t.vanName}</div>
                        <div className="text-xs opacity-60">Waiting on {t.fromTcName || 'current TC'} · Sent {created}</div>
                        {t.note && <div className="mt-1 text-xs opacity-80">Note: {t.note}</div>}
                      </div>
                      <button
                        onClick={()=> respondTransfer(t.id, 'CANCEL')}
                        disabled={transferBusy === `${t.id}:CANCEL`}
                        className="rounded border px-3 py-1 text-xs"
                      >
                        Cancel Request
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })()}
      <section className="glass rounded-[28px] border border-amber-200/70 bg-amber-100/80 p-4 text-amber-900 shadow-lg dark:border-amber-700/70 dark:bg-amber-900/30 dark:text-amber-200">
        <div className="text-sm">
          Keep this page open while you are Online so your location updates reliably every 5 seconds. Turning on “Keep screen awake” can help prevent the device from sleeping.
        </div>
      </section>
      <section className="glass rounded-[32px] border border-white/20 p-5 shadow-lg dark:border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Tasks</h2>
          <button onClick={()=>{ setWalkTaskId(''); setWalkSelRider(null); setWalkForm({ riderId:'', name:'', phone:'', pickupAddr:'', pickupLat: undefined, pickupLng: undefined, dropAddr:'', dropLat: undefined, dropLng: undefined }); setWalkOpen(true); }} className="rounded border px-3 py-1 text-sm">Walk On…</button>
        </div>
        {tasks.length===0 && <div className="text-sm opacity-80">No tasks yet.</div>}
        <div className="space-y-2">
          {tasks.map((t:any)=> (
            <div key={t.id} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">#{t.rideCode}</div>
                <div className="text-xs opacity-70">{t.status}</div>
              </div>
              <div className="text-sm opacity-90">
                Rider: {taskDisplayName(t as any)}
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
                {(t.status==='ASSIGNED' || t.status==='EN_ROUTE') && getTaskCallPhone(t as any) && (
                  <a className="rounded border px-2 py-1" href={`tel:${getTaskCallPhone(t as any)}` }>
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
                <button onClick={()=>{ setWalkTaskId(t.id); setWalkSelRider(null); setWalkForm({ riderId:'', name:'', phone:'', pickupAddr:'', pickupLat: undefined, pickupLng: undefined, dropAddr:'', dropLat: undefined, dropLng: undefined }); setWalkOpen(true); }} className="rounded border px-3 py-1 text-sm">Walk On…</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {walkOpen && (
        <div className="fixed inset-0 grid place-items-center bg-black/50 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <div className="glass w-full max-w-md rounded-[32px] border border-white/20 p-5 shadow-xl dark:border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Add Walk-On Passenger</h3>
              <button onClick={()=> setWalkOpen(false)} aria-label="Close">✕</button>
            </div>
            {(() => {
              const t = tasks.find(x=> x.id===walkTaskId);
              const needsPickup = !t;
              return (
                <div className="grid gap-2">
                  <div className="text-xs opacity-70">{needsPickup ? 'Pickup: specify address' : `Pickup: ${t?.pickupAddr || '—'}`}</div>
                  {needsPickup && (
                    <AddressInput label="Pickup" value={walkForm.pickupAddr} onChange={(txt)=> setWalkForm((f:any)=> ({ ...f, pickupAddr: txt }))} onSelect={(o)=> setWalkForm((f:any)=> ({ ...f, pickupAddr: o.label, pickupLat: o.lat, pickupLng: o.lon }))} />
                  )}
                  <div className="relative">
                    <input className="p-2 rounded border text-sm w-full" placeholder="Name" value={walkForm.name} onChange={(e)=> setWalkForm((f:any)=> ({ ...f, name: e.target.value }))} onFocus={()=>{ if (walkNameOpts.length>0) setWalkNameOpen(true); }} />
                    {walkNameOpen && walkNameOpts.length>0 && (
                      <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded border bg-white text-black shadow-lg">
                        {walkNameOpts.map((u:any)=> (
                          <button key={u.id} type="button" className="block w-full text-left px-3 py-2 hover:bg-black/5" onMouseDown={(e)=> e.preventDefault()} onClick={()=>{ setWalkSelRider(u); setWalkForm((f:any)=> ({ ...f, riderId: u.id, name: `${u.firstName} ${u.lastName}`, phone: (u as any).phone||f.phone })); setWalkNameOpen(false); }}>
                            <div className="text-sm">{u.firstName} {u.lastName} <span className="opacity-60">{u.email}</span></div>
                            <div className="text-xs opacity-60">{u.rank||'—'} · {u.phone||'no phone'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {walkSelRider && (
                    <div className="text-xs inline-flex items-center gap-2 rounded-full border px-2 py-1 w-fit">
                      <span className="opacity-70">{walkSelRider.rank || '—'}</span>
                      <span className="opacity-60">{walkSelRider.phone || 'no phone'}</span>
                    </div>
                  )}
                  <input className="p-2 rounded border text-sm" placeholder="Cell Number" value={walkForm.phone} onChange={(e)=> setWalkForm((f:any)=> ({ ...f, phone: e.target.value }))} />
                  <AddressInput label="Drop Off" value={walkForm.dropAddr} onChange={(t)=> setWalkForm((f:any)=> ({ ...f, dropAddr: t }))} onSelect={(o)=> setWalkForm((f:any)=> ({ ...f, dropAddr: o.label, dropLat: o.lat, dropLng: o.lon }))} />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={()=> setWalkOpen(false)} className="rounded border px-3 py-1 text-sm">Cancel</button>
                    <button onClick={async()=>{
                      try{
                        const res = await fetch('/api/driver/walk-on', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ...walkForm, taskId: walkTaskId }) });
                        if (!res.ok){ const d = await res.json().catch(()=>({error:'Failed'})); throw new Error(d.error||'Failed'); }
                        showToast('Walk-on added'); setWalkOpen(false); setWalkTaskId(''); setWalkSelRider(null); setWalkForm({ riderId:'', name:'', phone:'', pickupAddr:'', pickupLat: undefined, pickupLng: undefined, dropAddr:'', dropLat: undefined, dropLng: undefined }); refreshTasks();
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

function taskDisplayName(t:any){
  try{
    const isUnlinked = t?.rider?.email === 'unlinked@sadd.local';
    if (isUnlinked && typeof t?.notes === 'string' && t.notes.trim().startsWith('{')){
      const meta = JSON.parse(t.notes);
      const n = meta?.manualContact?.name; if (n) return n;
    }
  }catch{}
  return `${t?.rider?.firstName||''} ${t?.rider?.lastName||''}`.trim();
}

function getTaskCallPhone(t:any){
  try{
    const isUnlinked = t?.rider?.email === 'unlinked@sadd.local';
    if (isUnlinked && typeof t?.notes === 'string' && t.notes.trim().startsWith('{')){
      const meta = JSON.parse(t.notes);
      const p = meta?.manualContact?.phone; if (p) return p;
    }
  }catch{}
  return t?.rider?.phone || '';
}


// (inline name suggestions implemented directly in the Name input above)
