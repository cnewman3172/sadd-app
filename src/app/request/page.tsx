"use client";
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const Map = dynamic(() => import('../../components/Map'), { ssr: false });
import AddressInput from '@/components/AddressInput';
import StarRating from '@/components/StarRating';

export default function RequestPage(){
  const [form, setForm] = useState<any>({ passengers:1 });
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [sse, setSse] = useState<EventSource | null>(null);
  const ICE_URL = 'https://ice.disa.mil/index.cfm?fa=card&sp=86951&s=360&dep=*DoD';
  const [vanPos, setVanPos] = useState<{lat:number,lng:number}|null>(null);
  const [etaSec, setEtaSec] = useState<number|null>(null);

  async function reloadHistory(){
    const data = await fetch('/api/my-rides?limit=3').then(r=>r.json());
    setHistory(data);
  }
  useEffect(()=>{ reloadHistory(); },[]);

  function useMyLocation(){ navigator.geolocation.getCurrentPosition(async (pos)=>{
    const { latitude, longitude } = pos.coords;
    setForm((f:any)=>({ ...f, pickupLat: latitude, pickupLng: longitude }));
  }); }

  async function submit(e: React.FormEvent){
    e.preventDefault();
    const res = await fetch('/api/rides/request', { method:'POST', body: JSON.stringify(form) });
    const data = await res.json();
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
    const onVanPing = (ev: MessageEvent)=>{
      try{
        const v = JSON.parse(ev.data);
        if (v?.id && v.id === status?.vanId){ setVanPos({ lat: v.lat, lng: v.lng }); }
      }catch{}
    };
    es.addEventListener('vans:location', onVanPing as any);
    setSse(es);
    return ()=>{ try{ es.close(); }catch{} };
  }, [status?.id]);

  // Whenever a van is assigned, fetch its current position initially
  useEffect(()=>{
    (async()=>{
      if (!status?.vanId) { setVanPos(null); setEtaSec(null); return; }
      try{
        const vans = await fetch('/api/vans', { cache: 'no-store' }).then(r=>r.json());
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
    <div className="grid md:grid-cols-3 gap-6 p-4 max-w-6xl mx-auto">
      <div className="md:col-span-2 space-y-4">
        {!status && (
          <form onSubmit={submit} className="grid gap-3 p-4 rounded-xl bg-white/70 dark:bg-white/10 backdrop-blur border border-white/20">
            <h1 className="text-xl font-semibold">Request a Ride</h1>
            <AddressInput
              label="Pickup"
              placeholder="Address or place"
              value={form.pickupAddr}
              onChange={(text)=> setForm((f:any)=> ({ ...f, pickupAddr: text }))}
              onSelect={(opt)=> setForm((f:any)=> ({ ...f, pickupAddr: opt.label, pickupLat: opt.lat, pickupLng: opt.lon }))}
            />
            <div>
              <button type="button" onClick={useMyLocation} className="mt-1 rounded px-3 py-1 border text-sm">Use my location</button>
            </div>
            <AddressInput
              label="Drop Off"
              placeholder="Address or place"
              value={form.dropAddr}
              onChange={(text)=> setForm((f:any)=> ({ ...f, dropAddr: text }))}
              onSelect={(opt)=> setForm((f:any)=> ({ ...f, dropAddr: opt.label, dropLat: opt.lat, dropLng: opt.lon }))}
            />
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
            <div className="space-y-4">
              {history.map((r)=> (
                <div key={r.id} className="text-sm border-t border-white/20 pt-2">
                  <div className="flex items-center justify-between">
                    <div>#{r.rideCode} — {r.status} — {new Date(r.requestedAt).toLocaleString()}</div>
                    {r.status==='DROPPED' && !r.rating && (
                      <ReviewInline ride={r} iceUrl={ICE_URL} onDone={()=> reloadHistory()} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <aside className="space-y-4">
        <div className="rounded-xl overflow-hidden border border-white/20">
          <Map
            height={400}
            vanMarkers={activeVansMarkers()}
            pickups={status ? getPickupMarkers(status) : []}
            drops={status ? getDropMarkers(status) : []}
            markers={[]}
          />
        </div>
        {status && (status.status==='EN_ROUTE' || status.status==='PICKED_UP') && (
          <div className="rounded-xl p-3 border border-white/20 bg-white/70 dark:bg-white/10">
            <div className="text-sm">Assigned Van: {status.vanId ? `#${status.vanId.slice(0,8)}` : '—'}</div>
            <div className="text-sm">ETA: {etaSec!=null ? formatEta(etaSec) : '—'}</div>
          </div>
        )}
      </aside>
    </div>
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
    <div className="flex items-center gap-3">
      <StarRating value={stars} onChange={setStars} />
      <input className="flex-1 p-2 rounded border" placeholder="Optional feedback" value={comment} onChange={(e)=> setComment(e.target.value)} />
      <button disabled={busy} onClick={()=> submit(false)} className="rounded border px-3 py-1">Submit</button>
      <button disabled={busy} onClick={()=> submit(true)} className="rounded border px-3 py-1 opacity-80">Skip extra</button>
      {error && <span className="text-red-600 text-xs">{error}</span>}
    </div>
  );
}

function getPickupMarkers(status:any){
  const arr: Array<{lat:number,lng:number}> = [];
  if (status.status==='EN_ROUTE' && typeof status.pickupLat==='number' && typeof status.pickupLng==='number'){
    arr.push({ lat: status.pickupLat, lng: status.pickupLng });
  }
  return arr;
}

function getDropMarkers(status:any){
  const arr: Array<{lat:number,lng:number}> = [];
  if (status.status==='PICKED_UP' && typeof status.dropLat==='number' && typeof status.dropLng==='number'){
    arr.push({ lat: status.dropLat, lng: status.dropLng });
  }
  return arr;
}

function activeVansMarkers(){
  // We rely on the server-provided vans list from /api/vans? In this page we didn't load all vans previously.
  // Keep lightweight: no vans layer if not fetched; the assigned van is tracked separately via vanPos.
  return [] as Array<{id:string,lat:number,lng:number,color:string}>;
}

function formatEta(sec:number){
  const m = Math.floor(sec/60); const s = sec%60;
  if (m>=60){ const h=Math.floor(m/60); const rm=m%60; return `${h}h ${rm}m`; }
  return `${m}m ${s}s`;
}
