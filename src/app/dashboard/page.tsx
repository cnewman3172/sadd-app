"use client";
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
const Map = dynamic(() => import('../../components/Map'), { ssr: false });
import AddressInput from '@/components/AddressInput';
import { showToast } from '@/components/Toast';
import type { Ride, Van } from '@/types';

export default function Dashboard(){
  const [rides, setRides] = useState<Ride[]>([]);
  const [vans, setVans] = useState<Van[]>([]);
  const [sseStatus, setSseStatus] = useState<'connecting'|'online'|'offline'>('connecting');
  const [suggestFor, setSuggestFor] = useState<Ride|null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ vanId:string; name:string; seconds:number; meters:number }>>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState<any>({ passengers: 1 });
  const [manualBusy, setManualBusy] = useState(false);

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
    setSseStatus('connecting');
    es.addEventListener('hello', ()=> setSseStatus('online'));
    es.addEventListener('ride:update', ()=> refresh());
    es.addEventListener('vans:update', ()=> refresh());
    es.addEventListener('vans:location', (e)=>{
      try{
        const d = JSON.parse((e as MessageEvent).data);
        setVans((prev:any[])=> prev.map(v=> v.id===d.id ? { ...v, currentLat:d.lat, currentLng:d.lng } : v));
      }catch{}
    });
    es.onerror = ()=> setSseStatus('offline');
    return ()=>{ es.close(); setSseStatus('offline'); };
  },[]);

  const pending = useMemo(()=> rides.filter((r:Ride)=>r.status==='PENDING'),[rides]);
  const active = useMemo(()=> rides.filter((r:Ride)=>['ASSIGNED','EN_ROUTE','PICKED_UP'].includes(r.status)),[rides]);
  function candidateCount(r: Ride){
    return vans.filter(v=> v.status==='ACTIVE' && typeof v.currentLat==='number' && typeof v.currentLng==='number' && (v.capacity||0) >= (r.passengers||1)).length;
  }

  async function quickAssign(r: Ride){
    const s = await fetch(`/api/assign/suggest?rideId=${r.id}`).then(r=>r.json());
    const best = s.ranked?.[0];
    if (!best) return alert('No suitable vans online.');
    const mins = Math.round((best.seconds||0)/60);
    if (!confirm(`Assign ${best.name} (~${mins} min) to #${r.rideCode}?`)) return;
    await setStatus(r.id, 'ASSIGNED', best.vanId);
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

  return (
    <div className="p-6 max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-4">
        <Card title="Live Ops">
          <div className="text-sm space-y-1">
            <div>Active Vans: {vans.length}</div>
            <div>Pickups In Progress: {active.length}</div>
            <div>Pending Requests: {pending.length}</div>
          </div>
          <div className="mt-3">
            <button onClick={()=> setManualOpen(true)} className="rounded border px-3 py-2 text-sm">New Phone Request…</button>
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
        <Card title={`Incoming Requests ${sseStatus==='online' ? '• Live' : sseStatus==='connecting' ? '• Connecting' : '• Offline'}`}>
          <div className="space-y-2">
            {pending.length===0 && <div className="text-sm opacity-80">No pending requests.</div>}
            {pending.map((r)=> (
              <div key={r.id} className="rounded border p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">#{r.rideCode} · {r.rider?.firstName} {r.rider?.lastName}</div>
                  <div className="text-xs opacity-70">{new Date(r.requestedAt).toLocaleString()}</div>
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
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-900 border border-white/20 p-4">
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
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-neutral-900 border border-white/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Manual Ride Request</h3>
              <button onClick={()=> setManualOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <input className="p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm text-black dark:text-white" placeholder="Caller Name" value={manual.name||''} onChange={(e)=> setManual({...manual, name:e.target.value})} />
                <input className="p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm text-black dark:text-white" placeholder="Phone" value={manual.phone||''} onChange={(e)=> setManual({...manual, phone:e.target.value})} />
              </div>
              <AddressInput label="Pickup" value={manual.pickupAddr||''} onChange={(t)=> setManual({...manual, pickupAddr: t})} onSelect={(o)=> setManual({...manual, pickupAddr:o.label, pickupLat:o.lat, pickupLng:o.lon})} />
              <AddressInput label="Drop Off" value={manual.dropAddr||''} onChange={(t)=> setManual({...manual, dropAddr: t})} onSelect={(o)=> setManual({...manual, dropAddr:o.label, dropLat:o.lat, dropLng:o.lon})} />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min={1} max={8} className="p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm text-black dark:text-white" value={manual.passengers||1} onChange={(e)=> setManual({...manual, passengers:Number(e.target.value)})} />
                <input className="p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm text-black dark:text-white" placeholder="Notes (optional)" value={manual.notes||''} onChange={(e)=> setManual({...manual, notes:e.target.value})} />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={()=> setManualOpen(false)} className="rounded border px-3 py-1 text-sm">Cancel</button>
                <button disabled={manualBusy} onClick={async()=>{
                  setManualBusy(true);
                  try{
                    const res = await fetch('/api/admin/rides', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(manual) });
                    if (!res.ok){ const d = await res.json().catch(()=>({error:'failed'})); throw new Error(d.error||'failed'); }
                    setManualOpen(false); setManual({ passengers:1 });
                    showToast('Manual ride created');
                    refresh();
                  }catch(e:any){ alert(e.message||'Failed'); }
                  finally{ setManualBusy(false); }
                }} className="rounded bg-black text-white px-3 py-1 text-sm">Create Ride</button>
              </div>
            </div>
          </div>
        </div>
      )}
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

function CoordinatorMap({ vans }:{ vans: any[] }){
  const [selectedVan, setSelectedVan] = useState<string>('');
  const [poi, setPoi] = useState<{ pickups:Array<{lat:number,lng:number}>, drops:Array<{lat:number,lng:number}> }>({ pickups:[], drops:[] });
  const [routes, setRoutes] = useState<Array<Array<[number,number]>>>([]);
  const [panel, setPanel] = useState<{ name:string; pax:number; cap:number; tasks:number }|null>(null);

  async function loadTasks(id:string){
    setRoutes([]); setPoi({ pickups:[], drops:[] });
    const r = await fetch(`/api/vans/${id}/tasks`).then(r=>r.json());
    const tasks = r.tasks||[];
    setPoi({ pickups: tasks.map((t:any)=>({lat:t.pickupLat,lng:t.pickupLng})), drops: tasks.map((t:any)=>({lat:t.dropLat,lng:t.dropLng})) });
    // Build OSRM route through van -> pickups/drops in order
    const van = vans.find((v:any)=> v.id===id);
    if (van?.currentLat && van?.currentLng && tasks.length>0){
      const coords: Array<[number,number]> = [[van.currentLat, van.currentLng]];
      for (const t of tasks){ coords.push([t.pickupLat,t.pickupLng], [t.dropLat,t.dropLng]); }
      try{
        const res = await fetch('/api/route', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ coords }) });
        if (res.ok){ const d = await res.json(); setRoutes([d.coordinates||[]]); }
      }catch{}
    }
    setPanel({ name: van?.name || 'Van', pax: Number(van?.passengers||0), cap: Number(van?.capacity||0), tasks: tasks.length });
  }

  const vanMarkers = vans.filter(v=> v.currentLat&&v.currentLng).map((v:any)=>{
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
        <div className="absolute top-3 right-3 rounded-lg bg-white text-black dark:bg-neutral-900 dark:text-white border border-black/10 dark:border-white/20 shadow px-3 py-2 text-sm">
          <div className="font-semibold mb-1">{panel.name}</div>
          <div>Passengers: {panel.pax}/{panel.cap}</div>
          <div>Tasks: {panel.tasks}</div>
          <button className="mt-2 rounded border px-2 py-1 text-xs" onClick={()=>{ setSelectedVan(''); setRoutes([]); setPoi({pickups:[],drops:[]}); }}>Clear</button>
        </div>
      )}
    </div>
  );
}
