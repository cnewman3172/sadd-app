"use client";
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
const Map = dynamic(() => import('../../components/Map'), { ssr: false });
import AddressInput from '@/components/AddressInput';
import { showToast } from '@/components/Toast';
import type { Ride, Van } from '@/types';

export default function DashboardClient(){
  const [rides, setRides] = useState<Ride[]>([]);
  const [vans, setVans] = useState<Van[]>([]);
  const [sseStatus, setSseStatus] = useState<'connecting'|'online'|'offline'>('connecting');
  const [suggestFor, setSuggestFor] = useState<Ride|null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ vanId:string; name:string; seconds:number; meters:number }>>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState<any>({});
  const [manualBusy, setManualBusy] = useState(false);
  const [manualEtaSec, setManualEtaSec] = useState<number|null>(null);
  const [manualEtaVan, setManualEtaVan] = useState<string>('');
  const [selRider, setSelRider] = useState<any|null>(null);
  const [nameOpts, setNameOpts] = useState<any[]>([]);
  const [nameOpen, setNameOpen] = useState(false);
  const [phoneOpts, setPhoneOpts] = useState<any[]>([]);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [activeEtas, setActiveEtas] = useState<Record<string, { toPickupSec: number|null; toDropSec: number|null }>>({});
  const lastEtaRef = (typeof window!=='undefined' ? (window as any).__etaRef : null) || { current: 0 } as { current: number };
  const [notifOk, setNotifOk] = useState<boolean>(true);
  const [fallbackByVan, setFallbackByVan] = useState<Record<string, boolean>>({});
  const [autoModal, setAutoModal] = useState<{ open:boolean; ride: Ride|null; best: { vanId:string; name:string; seconds:number }|null }>({ open:false, ride:null, best:null });
  const [saddActive, setSaddActive] = useState<boolean|null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  const router = useRouter();
  const resetManual = ()=>{
    setManualOpen(false);
    setManual({});
    setSelRider(null);
    setManualEtaSec(null);
    setManualEtaVan('');
    setNameOpen(false);
    setNameOpts([]);
    setPhoneOpen(false);
    setPhoneOpts([]);
  };

  async function refresh(){
    const [r, v, status] = await Promise.all([
      fetch('/api/rides?take=100', { credentials:'include' }).then(r=>r.json()),
      fetch('/api/vans', { credentials:'include' }).then(r=>r.json()),
      fetch('/api/status', { cache: 'no-store' }).then(async (res)=> res.ok ? res.json() : null).catch(()=>null),
    ]);
    setRides(r);
    setVans(v);
    setSaddActive(status && typeof status.active === 'boolean' ? Boolean(status.active) : null);
    // Compute ETAs right after data loads
    try{ await computeActiveEtas(r as any, v as any); }catch{}
  }

  // Inline rider lookup bound to the Name input
  useEffect(()=>{
    const t = setTimeout(async()=>{
      const q = String(manual.name||'').trim();
      if (q.length < 2){ setNameOpts([]); setNameOpen(false); return; }
      try{ const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`, { cache:'no-store', credentials:'include' }); const d = await r.json(); setNameOpts(d||[]); setNameOpen(true); }catch{}
    }, 250);
    return ()=> clearTimeout(t);
  }, [manual.name]);
  useEffect(()=>{
    const t = setTimeout(async()=>{
      const digits = String(manual.phone||'').replace(/\D+/g,'');
      if (digits.length < 4){ setPhoneOpts([]); setPhoneOpen(false); return; }
      try{
        const r = await fetch(`/api/admin/users?q=${encodeURIComponent(digits)}`, { cache:'no-store', credentials:'include' });
        const d = await r.json();
        const matches = Array.isArray(d) ? d.filter((u:any)=> (u.phone||'').replace(/\D+/g,'').includes(digits)) : [];
        setPhoneOpts(matches);
        setPhoneOpen(matches.length>0);
      }catch{}
    }, 250);
    return ()=> clearTimeout(t);
  }, [manual.phone]);

  useEffect(()=>{ refresh(); const id = setInterval(refresh, 5000); return ()=>clearInterval(id); },[]);
  useEffect(()=>{
    (async()=>{ const ok = await ensureNotifications(); setNotifOk(ok); })();
  },[]);
  useEffect(()=>{
    const es = new EventSource('/api/stream');
    setSseStatus('connecting');
    es.addEventListener('hello', ()=> setSseStatus('online'));
    es.addEventListener('ride:update', ()=> refresh());
    es.addEventListener('vans:update', ()=> refresh());
    // Throttle location updates to ~5s batches
    const buffer: Record<string,{lat:number,lng:number}> = {};
    let timer: number | null = null;
    const flush = ()=>{
      setVans((prev:any[])=> {
        const next = prev.map(v=> buffer[v.id] ? { ...v, currentLat: buffer[v.id].lat, currentLng: buffer[v.id].lng } : v);
        // Recompute ETAs for active trips when positions change (throttled)
        const now = Date.now();
        if (now - lastEtaRef.current >= 15000){
          lastEtaRef.current = now;
          computeActiveEtas(rides, next);
        }
        return next;
      });
      for (const k in buffer) delete buffer[k];
      if (timer!==null){ window.clearTimeout(timer); timer=null; }
    };
    const onLoc = (e: MessageEvent)=>{
      try{
        const d = JSON.parse(e.data);
        if (d?.id){ buffer[d.id] = { lat: d.lat, lng: d.lng }; }
        if (timer===null){ timer = window.setTimeout(flush, 5000); }
      }catch{}
    };
    es.addEventListener('vans:location', onLoc as any);
    es.onerror = ()=> setSseStatus('offline');
    return ()=>{ es.close(); if (timer!==null){ window.clearTimeout(timer); } setSseStatus('offline'); };
  },[]);

  const pending = useMemo(()=> rides.filter((r:Ride)=>r.status==='PENDING'),[rides]);
  const active = useMemo(()=> rides.filter((r:Ride)=>['ASSIGNED','EN_ROUTE','PICKED_UP'].includes(r.status)),[rides]);
  const activeVans = useMemo(()=> vans.filter((v:any)=> v.status==='ACTIVE'), [vans]);

  async function toggleActive(){
    if (toggleBusy) return;
    setToggleBusy(true);
    try{
      const res = await fetch('/api/admin/toggle-active', { method: 'POST' });
      if (!res.ok){
        const data = await res.json().catch(()=>({ error: 'Toggle failed' }));
        throw new Error(data.error || 'Toggle failed');
      }
      const data = await res.json();
      const nextState = Boolean(data.active);
      setSaddActive(nextState);
      showToast(nextState ? 'SADD marked Active' : 'SADD marked Inactive');
      try{ router.refresh(); }catch{}
    }catch(e:any){
      showToast(e?.message || 'Toggle failed');
    }finally{
      setToggleBusy(false);
    }
  }

  async function computeActiveEtas(rArr: Ride[], vArr: any[]){
    const byVan: Record<string, any[]> = {};
    rArr.filter((r:any)=> ['ASSIGNED','EN_ROUTE','PICKED_UP'].includes(r.status) && r.vanId)
      .forEach((r:any)=>{ (byVan[r.vanId!] ||= []).push(r); });
    const result: Record<string, { toPickupSec: number|null; toDropSec: number|null }> = { };
    const fb: Record<string, boolean> = {};
    for (const vanId of Object.keys(byVan)){
      try{
        const res = await fetch(`/api/plan/eta?vanId=${vanId}`, { cache:'no-store' });
        if (!res.ok){ continue; }
        const d = await res.json();
        fb[vanId] = res.headers.get('X-Plan-ETA-Fallback') === '1';
        const m = (d?.etas)||{};
        for (const r of byVan[vanId]){
          result[r.id] = { toPickupSec: m[r.id]?.toPickupSec ?? null, toDropSec: m[r.id]?.toDropSec ?? null };
        }
      }catch{}
    }
    setActiveEtas(result);
    setFallbackByVan(fb);
  }
  function candidateCount(r: Ride){
    return vans.filter(v=> v.status==='ACTIVE' && typeof v.currentLat==='number' && typeof v.currentLng==='number' && (v.capacity||0) >= (r.passengers||1)).length;
  }

  async function quickAssign(r: Ride){
    const s = await fetch(`/api/assign/suggest?rideId=${r.id}`).then(r=>r.json());
    const best = s.ranked?.[0];
    if (!best) { showToast('No suitable vans online.'); return; }
    setAutoModal({ open:true, ride: r, best: { vanId: best.vanId, name: best.name, seconds: Number(best.seconds||0) } });
  }

  async function setStatus(id:string, status:string, vanId?:string){
    await fetch(`/api/rides/${id}`, { method:'PUT', body: JSON.stringify({ status, vanId }) });
    refresh();
  }
  async function openSuggestions(r:Ride){
    setSuggestFor(r); setLoadingSuggest(true);
    try {
      const s = await fetch(`/api/assign/suggest?rideId=${r.id}`).then(r=>r.json());
      setSuggestions(s.ranked?.slice(0,5) || []);
    } finally { setLoadingSuggest(false); }
  }
  async function chooseSuggestion(vanId:string){
    if (!suggestFor) return;
    await setStatus(suggestFor.id, 'ASSIGNED', vanId);
    setSuggestFor(null); setSuggestions([]);
  }

  async function ensureNotifications(forcePrompt = false){
    try{
      if (typeof window === 'undefined') return false;
      if (!('Notification' in window)) return false;
      let perm = Notification.permission;
      if (perm === 'default' || forcePrompt){
        perm = await Notification.requestPermission();
      }
      if (perm !== 'granted') return false;
      const vapid = await fetch('/api/push/key', { cache:'no-store' }).then(r=>r.json()).catch(()=>null);
      const pk = vapid?.publicKey || '';
      if (!pk) return true;
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

  return (
    <div className="mx-auto w-full max-w-6xl grid gap-6 px-4 py-10 md:grid-cols-3">
      {!notifOk && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/50 p-4 backdrop-blur">
          <div className="glass w-full max-w-md rounded-[32px] border border-white/20 p-5 text-center shadow-xl dark:border-white/10">
            <h3 className="font-semibold mb-2">Enable Notifications</h3>
            <p className="text-sm opacity-80 mb-3">Dispatch requires notifications so you don’t miss new requests.</p>
            <div className="flex justify-center gap-2">
              <button className="btn-primary" onClick={async()=>{ const ok = await ensureNotifications(true); setNotifOk(ok); if (!ok) showToast('Please allow notifications in your browser settings.'); }}>Enable</button>
            </div>
          </div>
        </div>
      )}
      <div className="md:col-span-1 space-y-4">
        <Card title="Live Ops">
          <div className="rounded-[24px] border border-white/20 bg-white/40 px-3 py-3 text-sm shadow-sm dark:border-white/10 dark:bg-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className={`font-semibold ${saddActive==null ? 'opacity-70' : saddActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                Status: {saddActive==null ? '—' : saddActive ? 'Active' : 'Inactive'}
              </div>
              <button
                onClick={toggleActive}
                disabled={toggleBusy}
                className="rounded-full border border-black/20 px-4 py-1.5 text-sm font-semibold shadow-sm transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
              >
                {toggleBusy ? 'Updating…' : saddActive ? 'Set Inactive' : 'Set Active'}
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            {[{
              label: 'ACTIVE VANS',
              value: activeVans.length,
            }, {
              label: 'TRIPS IN PROGRESS',
              value: active.length,
            }, {
              label: 'PENDING REQUESTS',
              value: pending.length,
            }].map(stat => (
              <div key={stat.label} className="flex flex-col items-center justify-center rounded-2xl border border-white/20 bg-white/70 px-4 py-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
                <div className="text-[14px] font-semibold text-zinc-500 dark:text-zinc-400">{stat.label}</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">{stat.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <button
              onClick={()=>{
                setManual({});
                setSelRider(null);
                setManualEtaSec(null);
                setManualEtaVan('');
                setNameOpts([]);
                setNameOpen(false);
                setManualOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-emerald-300 hover:bg-white dark:border-white/20 dark:bg-white/10 dark:hover:border-emerald-500/40"
            >
              <span>New Phone Request</span>
              <span aria-hidden className="text-base">＋</span>
            </button>
          </div>
        </Card>
        <Card title="Active Fleet">
          <div className="text-sm space-y-2">
            {activeVans.length===0 && <div className="opacity-80">No active vans.</div>}
            {activeVans.map((v:any)=> (
              <div key={v.id} className="flex items-center justify-between">
                <div>{v.name} <span className="opacity-60">({v.capacity})</span></div>
                <div className="text-xs opacity-70">{v.status}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="md:col-span-2 space-y-4">
        <Card title={`Incoming Requests ${sseStatus==='online' ? '• Live' : sseStatus==='connecting' ? '• Connecting' : '• Offline'}`}>
          <div className="space-y-2">
            {pending.length===0 && <div className="text-sm opacity-80">No pending requests.</div>}
            {pending.map((r)=> (
              <div key={r.id} className="rounded border p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">#{r.rideCode} · {displayName(r as any)}</div>
              <div className="text-xs opacity-70">{new Date(r.requestedAt).toLocaleString('en-US', { timeZone: 'UTC', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })} UTC</div>
                </div>
                <div className="text-sm opacity-80 flex items-center gap-2">
                  <span>{r.pickupAddr} → {r.dropAddr}</span>
                  {(() => {
                    const n = candidateCount(r);
                    const color = n === 0 ? 'border-red-500 text-red-600' : n < 3 ? 'border-amber-500 text-amber-600' : 'border-green-600 text-green-700';
                    return <span className={`text-[11px] rounded-full px-2 py-0.5 border ${color}`}>{n} candidate{n===1?'':'s'}</span>;
                  })()}
                </div>
                <div className="flex gap-2 items-center">
                  <select className="border rounded px-2 py-1 text-sm" id={`van-${r.id}`} defaultValue="">
                    <option value="">Select van</option>
                    {vans.map((v)=> <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <button onClick={()=>{
                    const sel = document.getElementById(`van-${r.id}`) as HTMLSelectElement | null;
                    const vanId = sel?.value || undefined;
                    setStatus(r.id, 'ASSIGNED', vanId);
                  }} className="rounded bg-black text-white px-3 py-1 text-sm">Assign</button>
                  <button onClick={()=>openSuggestions(r)} className="rounded border px-3 py-1 text-sm">Suggest</button>
                  <button onClick={()=>quickAssign(r)} className="rounded border px-3 py-1 text-sm">Quick Assign</button>
                  {/* Navigation and call actions are reserved for Truck Commanders UI */}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Active Trips">
          <div className="space-y-2">
            {active.length===0 && <div className="text-sm opacity-80">No active trips.</div>}
            {active.map((r)=> (
              <div key={r.id} className="rounded border p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">#{r.rideCode} · {displayName(r as any)}</div>
                  <div className="text-xs opacity-70 flex items-center gap-2 flex-wrap">
                    {r.status}
                    {(() => {
                      const e = activeEtas[r.id];
                      if (!e) return null;
                      const pick = e.toPickupSec!=null ? `${Math.max(1,Math.round(e.toPickupSec/60))} min` : null;
                      const drop = e.toDropSec!=null ? `${Math.max(1,Math.round(e.toDropSec/60))} min` : null;
                      if (r.status==='PICKED_UP') return drop ? <> · Drop ETA {drop}</> : null;
                      if (pick && drop) return <> · Pickup ETA {pick} · Drop ETA {drop}</>;
                      if (pick) return <> · Pickup ETA {pick}</>;
                      return null;
                    })()}
                    {(() => {
                      const vid = (r as any).vanId as string|undefined;
                      if (!vid) return null;
                      if (!fallbackByVan[vid]) return null;
                      return <span className="text-[10px] rounded-full px-2 py-0.5 border border-amber-500 text-amber-700">Fallback ETA</span>;
                    })()}
                  </div>
                </div>
                <div className="text-sm opacity-80">{r.pickupAddr} → {r.dropAddr}</div>
                {(() => {
                  // Show manual contact pill and call link when rider is Unlinked and notes contain contact
                  try{
                    const isUnlinked = (r as any)?.rider?.email === 'unlinked@sadd.local';
                    let name=''; let phone='';
                    if (isUnlinked && typeof (r as any).notes === 'string' && (r as any).notes.trim().startsWith('{')){
                      const meta = JSON.parse((r as any).notes);
                      if (meta?.manualContact){ name = meta.manualContact.name||''; phone = meta.manualContact.phone||''; }
                    }
                    if (name || phone){
                      return (
                        <div className="text-xs inline-flex items-center gap-2 rounded-full border px-2 py-1 w-fit">
                          <span className="opacity-70">{name || 'Unlinked'}</span>
                          {phone && <a className="underline" href={`tel:${phone}`}>{phone}</a>}
                        </div>
                      );
                    }
                  }catch{}
                  return null;
                })()}
                <div className="flex gap-2 items-center">
                  <button onClick={async()=>{ if (!confirm(`Cancel #${r.rideCode}?`)) return; await setStatus(r.id, 'CANCELED'); }} className="rounded border px-3 py-1 text-sm border-red-500 text-red-600">Cancel Ride</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Live Operations Map">
          <CoordinatorMap vans={vans as any} />
        </Card>
      </div>
      {suggestFor && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/50 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <div className="glass w-full max-w-md rounded-[32px] border border-white/20 p-5 shadow-xl dark:border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Suggestions for #{suggestFor.rideCode}</h3>
              <button onClick={()=>{setSuggestFor(null); setSuggestions([]);}} aria-label="Close">✕</button>
            </div>
            {loadingSuggest && <div className="text-sm opacity-80">Loading…</div>}
            {!loadingSuggest && suggestions.length===0 && (
              <div className="text-sm opacity-80">No suitable vans online.</div>
            )}
            <div className="grid gap-2">
              {suggestions.map(s=> (
                <div key={s.vanId} className="flex items-center justify-between rounded border p-2">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs opacity-70">~{Math.round((s.seconds||0)/60)} min · {(s.meters/1000).toFixed(1)} km</div>
                  </div>
                  <button onClick={()=>chooseSuggestion(s.vanId)} className="rounded bg-black text-white px-3 py-1 text-sm">Assign</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {manualOpen && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/50 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <div className="glass w-full max-w-lg rounded-[32px] border border-white/20 p-5 shadow-xl dark:border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Manual Ride Request</h3>
              <button onClick={resetManual} aria-label="Close">✕</button>
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input
                    className="p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm text-black dark:text-white w-full"
                    placeholder="Caller Name"
                    value={manual.name||''}
                    onChange={(e)=> { setManual({...manual, name:e.target.value}); }}
                    onFocus={()=>{ if (nameOpts.length>0) setNameOpen(true); }}
                    onBlur={()=> setTimeout(()=> setNameOpen(false), 120)}
                    onKeyDown={(e)=>{ if (e.key==='Escape') setNameOpen(false); }}
                  />
                  {nameOpen && nameOpts.length>0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-xl popover text-black dark:text-white">
                      {nameOpts.map((u:any)=> (
                        <button key={u.id} type="button" className="block w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10" onMouseDown={(e)=> e.preventDefault()} onClick={()=>{ setSelRider(u); setManual((m:any)=> ({ ...m, riderId: u.id, name: `${u.firstName} ${u.lastName}`, phone: (u as any).phone||m.phone })); setNameOpen(false); }}>
                          <div className="text-sm">{u.firstName} {u.lastName} <span className="opacity-60">{u.email}</span></div>
                          <div className="text-xs opacity-60">{u.rank||'—'} · {u.phone||'no phone'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <input className="p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm text-black dark:text-white w-full" placeholder="Phone" value={manual.phone||''} onChange={(e)=> setManual({...manual, phone:e.target.value})} onFocus={()=>{ if (phoneOpts.length>0) setPhoneOpen(true); }} onBlur={()=> setTimeout(()=> setPhoneOpen(false), 120)} />
                  {phoneOpen && phoneOpts.length>0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-xl popover text-black dark:text-white">
                      {phoneOpts.map((u:any)=> (
                        <button
                          key={`phone-${u.id}`}
                          type="button"
                          className="block w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                          onMouseDown={(e)=> e.preventDefault()}
                          onClick={()=>{
                            setSelRider(u);
                            setManual((m:any)=> ({ ...m, riderId: u.id, name: `${u.firstName} ${u.lastName}`.trim(), phone: u.phone || m.phone }));
                            setPhoneOpen(false);
                            if (!nameOpts.some((n:any)=> n.id === u.id)){
                              setNameOpts(prev=> [...prev, u]);
                            }
                          }}
                        >
                          <div className="text-sm">{u.firstName} {u.lastName} <span className="opacity-60">{u.email}</span></div>
                          <div className="text-xs opacity-60">{u.rank||'—'} · {u.phone||'no phone'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {selRider && (
                <div className="text-xs inline-flex items-center gap-2 rounded-full border px-2 py-1 w-fit">
                  <span className="opacity-70">{selRider.rank || '—'}</span>
                  <span className="opacity-60">{selRider.phone || 'no phone'}</span>
                </div>
              )}
              <AddressInput label="Pickup" value={manual.pickupAddr||''} onChange={(t)=> setManual({...manual, pickupAddr: t})} onSelect={(o)=> setManual({...manual, pickupAddr:o.label, pickupLat:o.lat, pickupLng:o.lon})} />
              <AddressInput label="Drop Off" value={manual.dropAddr||''} onChange={(t)=> setManual({...manual, dropAddr: t})} onSelect={(o)=> setManual({...manual, dropAddr:o.label, dropLat:o.lat, dropLng:o.lon})} />
              <input className="p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm text-black dark:text-white" placeholder="Notes (optional)" value={manual.notes||''} onChange={(e)=> setManual({...manual, notes:e.target.value})} />
              <ManualEta pickupLat={manual.pickupLat} pickupLng={manual.pickupLng} pax={1} onEta={(sec,van)=>{ setManualEtaSec(sec); setManualEtaVan(van); }} />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={resetManual} className="rounded border px-3 py-1 text-sm">Cancel</button>
                <button disabled={manualBusy} onClick={async()=>{
                  setManualBusy(true);
                  try{
                    const res = await fetch('/api/admin/rides', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ...manual, passengers: 1 }) });
                    if (!res.ok){ const d = await res.json().catch(()=>({error:'failed'})); throw new Error(d.error||'failed'); }
                    resetManual();
                    showToast('Manual ride created');
                    refresh();
                  }catch(e:any){ showToast(e?.message||'Failed'); }
                  finally{ setManualBusy(false); }
                }} className="rounded bg-black text-white px-3 py-1 text-sm">Create Ride</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {autoModal.open && autoModal.ride && autoModal.best && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/50 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <div className="glass w-full max-w-md rounded-[32px] border border-white/20 p-5 shadow-xl dark:border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Auto Assign</h3>
              <button onClick={()=> setAutoModal({ open:false, ride:null, best:null })} aria-label="Close">✕</button>
            </div>
            <div className="text-sm opacity-80 mb-3">
              Assign <span className="font-medium">{autoModal.best.name}</span>
              {` (~${Math.max(1, Math.round((autoModal.best.seconds||0)/60))} min)`}
              {` to #${autoModal.ride.rideCode}?`}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=> setAutoModal({ open:false, ride:null, best:null })} className="rounded border px-3 py-1 text-sm">Cancel</button>
              <button onClick={async()=>{ await setStatus(autoModal.ride!.id, 'ASSIGNED', autoModal.best!.vanId); setAutoModal({ open:false, ride:null, best:null }); }} className="rounded bg-black text-white px-3 py-1 text-sm">Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({title, children}:{title:string, children:any}){
  return (
    <section className="glass rounded-[32px] border border-white/20 p-5 shadow-lg dark:border-white/10">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ManualEta({ pickupLat, pickupLng, pax, onEta }:{ pickupLat?:number; pickupLng?:number; pax:number; onEta:(sec:number|null, van:string)=>void }){
  useEffect(()=>{
    (async()=>{
      onEta(null,'');
      if (typeof pickupLat !== 'number' || typeof pickupLng !== 'number') return;
      try{
        const r = await fetch(`/api/assign/eta?pickup=${pickupLat},${pickupLng}&pax=${pax}`, { cache:'no-store' });
        const d = await r.json();
        const sec = d?.best?.secondsToPickup as number|undefined;
        const van = d?.best?.name as string||'';
        if (sec!=null){ onEta(Math.round(sec), van); }
      }catch{}
    })();
  }, [pickupLat, pickupLng, pax]);
  return null;
}

function displayName(r: any){
  try{
    const isUnlinked = r?.rider?.email === 'unlinked@sadd.local';
    if (isUnlinked && typeof r?.notes === 'string' && r.notes.trim().startsWith('{')){
      const meta = JSON.parse(r.notes);
      const n = meta?.manualContact?.name;
      if (n) return n;
    }
  }catch{}
  return `${r?.rider?.firstName||''} ${r?.rider?.lastName||''}`.trim();
}

function CoordinatorMap({ vans }:{ vans: any[] }){
  const [selectedVan, setSelectedVan] = useState<string>('');
  const [poi, setPoi] = useState<{ pickups:Array<{lat:number,lng:number}>, drops:Array<{lat:number,lng:number}> }>({ pickups:[], drops:[] });
  const [routes, setRoutes] = useState<Array<Array<[number,number]>>>([]);
  const [panel, setPanel] = useState<{ name:string; pax:number; cap:number; tasks:number }|null>(null);

  async function loadTasks(id:string){
    setRoutes([]); setPoi({ pickups:[], drops:[] });
    let tasks: any[] = [];
    try{
      const resp = await fetch(`/api/vans/${id}/tasks`, { cache:'no-store' });
      if (!resp.ok){ showToast('Failed to load van tasks'); return; }
      const data = await resp.json();
      tasks = data?.tasks || [];
    }catch{ showToast('Failed to load van tasks'); return; }
    // Guard against invalid coords bleeding into the map
    const clean = (v:number)=> typeof v==='number' && isFinite(v);
    setPoi({
      pickups: tasks.filter((t:any)=> clean(t.pickupLat) && clean(t.pickupLng)).map((t:any)=>({lat:t.pickupLat,lng:t.pickupLng})),
      drops: tasks.filter((t:any)=> clean(t.dropLat) && clean(t.dropLng)).map((t:any)=>({lat:t.dropLat,lng:t.dropLng})),
    });
    // Build OSRM route through van -> pickups/drops in order
    const van = vans.find((v:any)=> v.id===id);
    const hasVanLoc = typeof van?.currentLat==='number' && typeof van?.currentLng==='number' && isFinite(van.currentLat) && isFinite(van.currentLng);
    if (hasVanLoc && tasks.length>0){
      const coords: Array<[number,number]> = [[van!.currentLat!, van!.currentLng!]];
      for (const t of tasks){
        if (clean(t.pickupLat) && clean(t.pickupLng)) coords.push([t.pickupLat,t.pickupLng]);
        if (clean(t.dropLat) && clean(t.dropLng)) coords.push([t.dropLat,t.dropLng]);
      }
      if (coords.length >= 2){
        try{
          const res = await fetch('/api/route', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ coords }) });
          if (res.ok){ const d = await res.json(); setRoutes([d.coordinates||[]]); }
          else { showToast('Failed to load route'); }
        }catch{ showToast('Failed to load route'); }
      }
    }
    setPanel({ name: van?.name || 'Van', pax: Number(van?.passengers||0), cap: Number(van?.capacity||0), tasks: tasks.length });
  }

  const vanMarkers = vans
    .filter(v=> v.status==='ACTIVE' && v.currentLat && v.currentLng)
    .map((v:any)=>{
      const pax = Number(v.passengers||0);
      const cap = Number(v.capacity||8);
      const color = pax<=0 ? '#16a34a' : pax<cap ? '#f59e0b' : '#dc2626';
      return { id:v.id, lat:v.currentLat!, lng:v.currentLng!, color };
  });

  return (
    <div className="relative">
      <Map
        height={500}
        vanMarkers={vanMarkers}
        pickups={selectedVan ? poi.pickups : []}
        drops={selectedVan ? poi.drops : []}
        polylines={selectedVan ? routes : []}
        onVanClick={(id)=>{ setSelectedVan(id); loadTasks(id); }}
      />
      {selectedVan && panel && (
        <div className="absolute top-3 right-3 z-[1200] rounded-lg bg-white text-black dark:bg-neutral-900 dark:text-white border border-black/10 dark:border-white/20 shadow px-3 py-2 text-sm">
          <div className="font-semibold mb-1">{panel.name}</div>
          <div>Passengers: {panel.pax}/{panel.cap}</div>
          <div>Tasks: {panel.tasks}</div>
          <button className="mt-2 rounded border px-2 py-1 text-xs" onClick={()=>{ setSelectedVan(''); setRoutes([]); setPoi({pickups:[],drops:[]}); }}>Clear</button>
        </div>
      )}
    </div>
  );
}
