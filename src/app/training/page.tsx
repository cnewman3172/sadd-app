"use client";
import { useEffect, useMemo, useState } from 'react';
import YouTubeRequired from '@/components/YouTubeRequired';

type Cat = 'SAFETY'|'DRIVER'|'TC'|'DISPATCHER';

const ORDER: Cat[] = ['SAFETY','DRIVER','TC','DISPATCHER'];
const VIDEOS: Record<Cat,string> = {
  SAFETY: 'dQw4w9WgXcQ', // placeholder
  DRIVER: 'dQw4w9WgXcQ',
  TC: 'dQw4w9WgXcQ',
  DISPATCHER: 'dQw4w9WgXcQ',
};

export default function Training(){
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Cat>('SAFETY');
  const [watched, setWatched] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(()=>{ fetch('/api/me', { cache:'no-store' }).then(r=>r.json()).then(setUser).catch(()=>{}); },[]);
  useEffect(()=>{ setWatched(false); setAnswered(false); },[tab]);

  const role: Cat | null = useMemo(()=>{
    switch(user?.role){ case 'SAFETY': return 'SAFETY'; case 'DRIVER': return 'DRIVER'; case 'TC': return 'TC'; case 'DISPATCHER': return 'DISPATCHER'; default: return null; }
  },[user]);

  const canAccess = (c: Cat)=>{
    if (user?.role==='ADMIN') return true;
    return role===c; // lock tabs by exact role as requested
  };
  const isDone = (c: Cat)=>{
    if (!user) return false;
    if (c==='SAFETY') return Boolean(user.trainingSafetyAt);
    if (c==='DRIVER') return Boolean(user.trainingDriverAt) && Boolean(user.checkRide);
    if (c==='TC') return Boolean(user.trainingTcAt);
    if (c==='DISPATCHER') return Boolean(user.trainingDispatcherAt);
    return false;
  };

  async function complete(){
    setBusy(true);
    try{
      const r = await fetch('/api/training/complete', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ category: tab }) });
      if (!r.ok){ const d = await r.json().catch(()=>({error:'failed'})); throw new Error(d.error||'failed'); }
      const d = await r.json();
      setUser((u:any)=> ({ ...u, ...d.user }));
      alert('Training completed for this category.');
    }catch(e:any){ alert(e.message||'Failed'); }
    finally{ setBusy(false); }
  }

  function renderTest(){
    return (
      <div className="rounded border p-3">
        <div className="font-medium mb-2">Quick Check</div>
        <div className="text-sm mb-2">What is the safe following distance?</div>
        <div className="flex flex-col gap-1">
          <label className="text-sm"><input type="radio" name="q1" onChange={()=> setAnswered(false)} /> 1 second</label>
          <label className="text-sm"><input type="radio" name="q1" onChange={()=> setAnswered(true)} /> 3 seconds</label>
          <label className="text-sm"><input type="radio" name="q1" onChange={()=> setAnswered(false)} /> 0.5 seconds</label>
        </div>
        <button disabled={!watched || !answered || busy} onClick={complete} className="mt-3 btn-primary">
          {busy ? 'Saving…' : 'Mark Complete'}
        </button>
        {tab==='DRIVER' && (
          <div className="mt-3 text-xs opacity-70">Note: Driver eligibility also requires completing the “Check Ride” in Settings.</div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 grid md:grid-cols-[240px,1fr] gap-4">
      {/* Top tab bar (always visible, mobile-friendly) */}
      <div className="md:col-span-2 order-[-1] md:order-none mb-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {ORDER.map(c=>{
            const label = c==='SAFETY'?'Safety':c==='DRIVER'?'Driver':c==='TC'?'Truck Commander':'Dispatcher';
            const active = tab===c;
            const locked = !canAccess(c);
            return (
              <button
                key={c}
                disabled={locked}
                onClick={()=> setTab(c)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-sm border ${active? 'bg-black text-white border-black' : 'glass hover:bg-black/5 dark:hover:bg-white/10'} ${locked? 'opacity-40 cursor-not-allowed' : ''}`}
                aria-pressed={active}
              >
                {label} {isDone(c)&& <span className="opacity-70">✔</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="hidden md:block">
        <nav className="rounded-xl border glass p-2 sticky top-20">
          {ORDER.map(c=> (
            <button key={c} disabled={!canAccess(c)} onClick={()=> setTab(c)} className={`block w-full text-left px-3 py-2 rounded ${tab===c?'bg-black text-white':'hover:bg-black/5 dark:hover:bg-white/10'} ${!canAccess(c)?'opacity-40 cursor-not-allowed':''}`}>
              {c==='SAFETY'?'Safety':c==='DRIVER'?'Driver':c==='TC'?'Truck Commander':'Dispatcher'} {isDone(c)&& <span className="text-xs opacity-70">(Done)</span>}
            </button>
          ))}
        </nav>
      </div>
      <div>
        <div className="md:hidden mb-3">
          <select className="w-full p-2 rounded border" value={tab} onChange={(e)=> setTab(e.target.value as Cat)}>{ORDER.map(c=> <option key={c} value={c} disabled={!canAccess(c)}>{c==='SAFETY'?'Safety':c==='DRIVER'?'Driver':c==='TC'?'Truck Commander':'Dispatcher'} {isDone(c)?'(Done)':''}</option>)}</select>
        </div>
        {!canAccess(tab) ? (
          <div className="rounded border p-4 text-sm opacity-80">Your role does not permit this training. Select your role’s tab.</div>
        ) : (
          <div className="grid gap-3">
            <YouTubeRequired videoId={VIDEOS[tab]} onFinished={()=> setWatched(true)} />
            {renderTest()}
          </div>
        )}
      </div>
    </div>
  );
}
