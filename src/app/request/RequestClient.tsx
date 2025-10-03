"use client";
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import PageShell from '@/components/PageShell';

const Map = dynamic(() => import('../../components/Map'), { ssr: false });
import AddressInput from '@/components/AddressInput';
import StarRating from '@/components/StarRating';

export default function RequestClient(){
  const [form, setForm] = useState<any>({});
  const [status, setStatus] = useState<any>(null);
  const [active, setActive] = useState<boolean|null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [pendingReview, setPendingReview] = useState<any|null>(null);
  const [showForm, setShowForm] = useState(true);
  const [sse, setSse] = useState<EventSource | null>(null);
  const ICE_URL = 'https://ice.disa.mil/index.cfm?fa=card&sp=86951&s=360&dep=*DoD';
  const [vanPos, setVanPos] = useState<{lat:number,lng:number}|null>(null);
  const [etaSec, setEtaSec] = useState<number|null>(null);
  const [vans, setVans] = useState<any[]>([]);
  const [selVan, setSelVan] = useState<string>('');
  const [route, setRoute] = useState<Array<Array<[number,number]>>>([]);
  const [preEtaSec, setPreEtaSec] = useState<number|null>(null);
  const [preEtaVan, setPreEtaVan] = useState<string>('');
  const [locating, setLocating] = useState(false);
  function formatEta(sec:number){
    const m = Math.floor(sec/60); const s = sec%60;
    if (m>=60){ const h=Math.floor(m/60); const rm=m%60; return `${h}h ${rm}m`; }
    return `${m}m ${s}s`;
  }
  function getPickupMarkers(localStatus:any){
    const arr: Array<{lat:number,lng:number}> = [];
    if (localStatus?.status==='EN_ROUTE' && typeof localStatus.pickupLat==='number' && typeof localStatus.pickupLng==='number'){
      arr.push({ lat: localStatus.pickupLat, lng: localStatus.pickupLng });
    }
    return arr;
  }
  function getDropMarkers(localStatus:any){
    const arr: Array<{lat:number,lng:number}> = [];
    if (localStatus?.status==='PICKED_UP' && typeof localStatus.dropLat==='number' && typeof localStatus.dropLng==='number'){
      arr.push({ lat: localStatus.dropLat, lng: localStatus.dropLng });
    }
    return arr;
  }
  function activeVansMarkers(){
    // For riders: only show the assigned van; otherwise hide other vans for privacy.
    if (!status?.vanId) return [] as Array<{id:string,lat:number,lng:number,color:string}>;
    const v = vans.find((x:any)=> x.id===status.vanId && x.status==='ACTIVE' && x.currentLat && x.currentLng);
    if (!v) return [] as Array<{id:string,lat:number,lng:number,color:string}>;
    const pax = Number(v.passengers||0);
    const cap = Number(v.capacity||8);
    const color = pax<=0 ? '#16a34a' : pax<cap ? '#f59e0b' : '#dc2626';
    return [{ id: v.id, lat: v.currentLat!, lng: v.currentLng!, color }];
  }
  async function handleVanClick(id:string){
    setSelVan(id); setRoute([]);
    try{
      const r = await fetch(`/api/vans/${id}/tasks`, { credentials:'include' }).then(r=>r.json());
      const tasks = r.tasks||[];
      const van = vans.find((v:any)=> v.id===id);
      if (van?.currentLat && van?.currentLng && tasks.length>0){
        const coords: Array<[number,number]> = [[van.currentLat, van.currentLng]];
        for (const t of tasks){ coords.push([t.pickupLat,t.pickupLng], [t.dropLat,t.dropLng]); }
        const res = await fetch('/api/route', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ coords }) });
        if (res.ok){ const d = await res.json(); setRoute([d.coordinates||[]]); }
      }
    }catch{}
  }

  async function reloadHistory(){
    const data = await fetch('/api/my-rides?limit=3', { credentials:'include' }).then(r=>r.json());
    setHistory(data);
    const pr = (data||[]).find((r:any)=> r.status==='DROPPED' && (r.rating==null));
    setPendingReview(pr||null);
    setShowForm(!pr);
  }
  useEffect(()=>{ reloadHistory(); },[]);
  useEffect(()=>{
    (async()=>{
      try{
        const h = await fetch('/api/status', { cache:'no-store' }).then(r=>r.json());
        setActive(typeof h?.active === 'boolean' ? Boolean(h.active) : null);
      }catch{ setActive(null); }
    })();
  },[]);
  useEffect(()=>{ refreshVans(); const id = setInterval(refreshVans, 5000); return ()=> clearInterval(id); },[]);
  async function refreshVans(){ try{ const v = await fetch('/api/vans', { cache:'no-store', credentials:'include' }).then(r=>r.json()); setVans(v||[]); }catch{} }

  // Pre-request ETA based on pickup location and best available van
  useEffect(()=>{
    (async()=>{
      setPreEtaSec(null); setPreEtaVan('');
      if (typeof form.pickupLat !== 'number' || typeof form.pickupLng !== 'number') return;
      const pax = 1;
      try{
        const d = await fetch(`/api/assign/eta?pickup=${form.pickupLat},${form.pickupLng}&pax=${pax}`, { cache:'no-store' }).then(r=>r.json());
        const sec = d?.best?.secondsToPickup as number|undefined;
        const van = d?.best?.name as string||'';
        if (sec!=null){ setPreEtaSec(Math.round(sec)); setPreEtaVan(van||''); }
      }catch{}
    })();
  }, [form.pickupLat, form.pickupLng]);

  function useMyLocation(){
    if (!navigator?.geolocation){ return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos)=>{
      const { latitude, longitude } = pos.coords;
      let resolvedLabel: string | null = null;
      try{
        const res = await fetch(`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`, { cache: 'no-store' });
        if (res.ok){
          const data = await res.json();
          if (data?.label && typeof data.label === 'string' && data.label.trim().length>0){
            resolvedLabel = data.label.trim();
          }
        }
      }catch(error){ console.error('Reverse geocode failed', error); }
      finally {
        const fallback = resolvedLabel || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        setForm((f:any)=>({ ...f, pickupAddr: fallback, pickupLat: latitude, pickupLng: longitude }));
        setLocating(false);
      }
    }, (err)=>{ console.error('Geolocation error', err); setLocating(false); }, { enableHighAccuracy: true, timeout: 10000 });
  }

  async function submit(e: React.FormEvent){
    e.preventDefault();
    const res = await fetch('/api/rides/request', {
      method:'POST',
      credentials:'include',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ...form, passengers: 1 })
    });
    const data = await res.json().catch(()=>null);
    if (!res.ok){
      const message = data?.error || 'Ride request failed. Please try again or contact Dispatch.';
      alert(message);
      return;
    }
    setStatus(data);
    // Refresh recent list to include the new ride
    reloadHistory();
  }

  // Live status updates via SSE for the active ride
  useEffect(()=>{
    if (!status?.id) return;
    const es = new EventSource('/api/stream');
    const onUpdate = (ev: MessageEvent)=>{
      try{
        const d = JSON.parse(ev.data);
        if (d && (d.id === status.id || d.code === status.rideCode)){
          setStatus((prev:any)=> prev ? { ...prev, status: d.status, vanId: d.vanId ?? prev.vanId } : prev);
          reloadHistory();
        }
      }catch{}
    };
    es.addEventListener('ride:update', onUpdate as any);

    // Throttle van location events into 5s batches
    let buffer: Record<string,{lat:number,lng:number}> = {};
    let timer: number | null = null;
    const flush = ()=>{
      const buf = buffer; buffer = {};
      if (status?.vanId && buf[status.vanId]){
        setVanPos({ lat: buf[status.vanId].lat, lng: buf[status.vanId].lng });
      }
      setVans(prev=> prev.map(x=> buf[x.id] ? { ...x, currentLat: buf[x.id].lat, currentLng: buf[x.id].lng } : x));
      if (timer!==null){ window.clearTimeout(timer); timer=null; }
    };
    const onVanPing = (ev: MessageEvent)=>{
      try{
        const v = JSON.parse(ev.data);
        if (v?.id && typeof v.lat==='number' && typeof v.lng==='number'){
          buffer[v.id] = { lat: v.lat, lng: v.lng };
          if (timer===null){ timer = window.setTimeout(flush, 5000); }
        }
      }catch{}
    };
    es.addEventListener('vans:location', onVanPing as any);
    setSse(es);
    return ()=>{ try{ es.close(); if (timer!==null){ window.clearTimeout(timer); } }catch{} };
  }, [status?.id]);

  // Whenever a van is assigned, fetch its current position initially
  useEffect(()=>{
    (async()=>{
      if (!status?.vanId) { setVanPos(null); setEtaSec(null); return; }
      try{
        const vans = await fetch('/api/vans', { cache: 'no-store', credentials:'include' }).then(r=>r.json());
        const v = (vans||[]).find((x:any)=> x.id===status.vanId);
        if (v?.currentLat && v?.currentLng){ setVanPos({ lat: v.currentLat, lng: v.currentLng }); }
      }catch{}
    })();
  }, [status?.vanId]);

  // Compute ETA when we have van position and the ride is active
  useEffect(()=>{
    (async()=>{
      if (!vanPos || !status) { setEtaSec(null); return; }
      const st = status.status;
      if (st !== 'EN_ROUTE' && st !== 'PICKED_UP'){ setEtaSec(null); return; }
      const toLat = st==='EN_ROUTE' ? status.pickupLat : status.dropLat;
      const toLng = st==='EN_ROUTE' ? status.pickupLng : status.dropLng;
      if (typeof toLat !== 'number' || typeof toLng !== 'number') { setEtaSec(null); return; }
      try{
        const url = `/api/eta?from=${vanPos.lat},${vanPos.lng}&to=${toLat},${toLng}`;
        const d = await fetch(url, { cache: 'no-store' }).then(r=>r.json());
        if (d?.seconds!=null) setEtaSec(Math.round(d.seconds));
      }catch{}
    })();
  }, [vanPos?.lat, vanPos?.lng, status?.status]);

  return (
    <PageShell pad={false}>
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-start">
      <div className="space-y-4">
        {/* Gate: prompt review first if there is an unrated DROPPED ride */}
        {pendingReview && (
          <section className="p-4 rounded-xl bg-white/70 dark:bg-white/10 backdrop-blur border border-white/20">
            <h2 className="text-lg font-semibold mb-2">How was your last ride?</h2>
            <p className="text-sm opacity-80 mb-3">Please leave a quick star rating for ride #{pendingReview.rideCode}. Your feedback helps improve SADD.</p>
            <ReviewInline ride={pendingReview} iceUrl={ICE_URL} onDone={()=>{ setPendingReview(null); setShowForm(true); reloadHistory(); }} />
            <div className="mt-2">
              <button onClick={()=>{ setShowForm(true); }} className="text-xs underline opacity-80">Skip for now</button>
            </div>
          </section>
        )}
        {!status && showForm && (
          <form onSubmit={submit} className="grid gap-3 p-4 rounded-xl bg-white/70 dark:bg-white/10 backdrop-blur border border-white/20">
            <h1 className="text-xl font-semibold">Request a Ride</h1>
            {active===false && <div className="text-sm text-red-700">SADD is currently inactive. Ride requests are disabled.</div>}
            <AddressInput
              label="Pickup"
              placeholder="Address or place"
              value={form.pickupAddr}
              onChange={(text)=> setForm((f:any)=> ({ ...f, pickupAddr: text }))}
              onSelect={(opt)=> setForm((f:any)=> ({ ...f, pickupAddr: opt.label, pickupLat: opt.lat, pickupLng: opt.lon }))}
            />
            {preEtaSec!=null && (
              <div className="text-xs opacity-70">Estimated pickup ETA: ~ {Math.max(1, Math.round(preEtaSec/60))} min {preEtaVan?`via ${preEtaVan}`:''}</div>
            )}
            <div>
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="mt-1 inline-flex items-center justify-center rounded-md border border-black/30 bg-white/90 px-3 py-2 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                {locating ? 'Locating…' : 'Use my location'}
              </button>
            </div>
            <AddressInput
              label="Drop Off"
              placeholder="Address or place"
              value={form.dropAddr}
              onChange={(text)=> setForm((f:any)=> ({ ...f, dropAddr: text }))}
              onSelect={(opt)=> setForm((f:any)=> ({ ...f, dropAddr: opt.label, dropLat: opt.lat, dropLng: opt.lon }))}
            />
            <div>
              <input className="p-3 rounded border w-full" placeholder="Notes (optional)" onChange={(e)=>setForm({...form, notes:e.target.value})} />
            </div>
            <button
              disabled={active===false}
              className="btn-primary w-full py-3 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Submit Request
            </button>
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
            <div className="space-y-4">
              {history.map((r)=> (
                <div key={r.id} className="text-sm border-t border-white/20 pt-2">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>#{r.rideCode} — {r.status} — {new Date(r.requestedAt).toLocaleString('en-US', { timeZone: 'UTC', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })} UTC</div>
                    {r.status==='DROPPED' && !r.rating && !pendingReview && (
                      <ReviewInline ride={r} iceUrl={ICE_URL} onDone={()=> reloadHistory()} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-xl border border-white/20 overflow-hidden">
          <Map
            height="clamp(280px, 48vh, 480px)"
            vanMarkers={activeVansMarkers()}
            pickups={status ? getPickupMarkers(status) : []}
            drops={status ? getDropMarkers(status) : []}
            markers={[]}
            polylines={selVan ? route : []}
            onVanClick={handleVanClick}
          />
        </div>
      </div>
      <aside className="space-y-4 md:sticky md:top-6">
        {status && (status.status==='EN_ROUTE' || status.status==='PICKED_UP') && (
          <div className="rounded-xl p-3 border border-white/20 bg-white/70 dark:bg-white/10">
            <div className="text-sm">Assigned Van: {status.vanId ? `#${status.vanId.slice(0,8)}` : '—'}</div>
            <div className="text-sm">ETA: {etaSec!=null ? formatEta(etaSec) : '—'}</div>
          </div>
        )}
      </aside>
      </div>
    </PageShell>
  );
}

function ReviewInline({ ride, iceUrl, onDone }:{ ride:any; iceUrl:string; onDone: ()=>void }){
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const lowEmail = 'fortwainwrightboss@army.mil';

  async function submit(bypass=false){
    if (stars<1){ setError('Please select a star rating'); return; }
    setBusy(true); setError(null);
    try{
      const r = await fetch(`/api/rides/${ride.id}/review`, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ rating: stars, comment: comment || undefined, bypass })
      });
      if (!r.ok){ const d = await r.json().catch(()=>({error:'failed'})); throw new Error(d.error||'Failed'); }
      // Route user for follow-up:
      if (stars <= 3){
        const subj = encodeURIComponent(`SADD Ride #${ride.rideCode} feedback (${stars}★)`);
        const body = encodeURIComponent(comment || '');
        window.location.href = `mailto:${lowEmail}?subject=${subj}&body=${body}`;
      }else{
        window.open(iceUrl, '_blank');
      }
      onDone();
    }catch(e:any){ setError(e.message||'Failed'); }
    finally{ setBusy(false); }
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <div className="shrink-0">
        <StarRating value={stars} onChange={setStars} />
      </div>
      <input
        className="w-full flex-1 min-w-0 rounded border p-2 sm:w-auto"
        placeholder="Optional feedback"
        value={comment}
        onChange={(e)=> setComment(e.target.value)}
      />
      <button
        disabled={busy}
        onClick={()=> submit(false)}
        className="w-full rounded border px-3 py-1 sm:w-auto"
      >
        Submit
      </button>
      <button
        disabled={busy}
        onClick={()=> submit(true)}
        className="w-full rounded border px-3 py-1 opacity-80 sm:w-auto"
      >
        Skip extra
      </button>
      {error && <span className="w-full text-red-600 text-xs">{error}</span>}
    </div>
  );
}
