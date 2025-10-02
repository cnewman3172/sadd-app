"use client";
import { useEffect, useMemo, useState } from 'react';
import YouTubeRequired from '@/components/YouTubeRequired';
import { showToast } from '@/components/Toast';
import PageShell from '@/components/PageShell';

type Cat = 'SAFETY'|'DRIVER'|'TC'|'DISPATCHER';
const ORDER: Cat[] = ['SAFETY','DRIVER','TC','DISPATCHER'];
const LABEL: Record<Cat,string> = { SAFETY:'Safety', DRIVER:'Driver', TC:'Truck Commander', DISPATCHER:'Dispatcher' };
const VIDEOS: Record<Cat,string> = {
  SAFETY: 'Mchhy3yWC18',
  DRIVER: '6ujWxQkdhXg',
  TC: 'ZPIBHhJ_iEg',
  DISPATCHER: 's6kaZKtDgmk',
};

export default function Training(){
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Cat>('SAFETY');
  const [phase, setPhase] = useState<'video'|'done'>('video');
  const [watched, setWatched] = useState(false);
  const [busy, setBusy] = useState(false);

  const driverTrainingComplete = Boolean(user?.trainingDriverAt);
  const driverCheckRideComplete = Boolean(user?.checkRide);

  useEffect(()=>{ fetch('/api/me', { cache:'no-store' }).then(r=>r.json()).then(setUser).catch(()=>{}); },[]);
  useEffect(()=>{ setPhase('video'); setWatched(false); },[tab]);

  const role: Cat | null = useMemo(()=>{
    switch(user?.role){ case 'SAFETY': return 'SAFETY'; case 'DRIVER': return 'DRIVER'; case 'TC': return 'TC'; case 'DISPATCHER': return 'DISPATCHER'; default: return null; }
  },[user]);

  const canAccess = (c: Cat)=>{
    const r = user?.role;
    if (r==='ADMIN') return true;
    if (r==='DISPATCHER') return ['DISPATCHER','TC','DRIVER','SAFETY'].includes(c);
    if (r==='TC') return ['TC','DRIVER','SAFETY'].includes(c);
    if (r==='DRIVER') return ['DRIVER','SAFETY'].includes(c);
    if (r==='SAFETY') return c==='SAFETY';
    return false;
  };
  const isDone = (c: Cat)=> !!user && (
    c==='SAFETY' ? Boolean(user.trainingSafetyAt) :
    c==='DRIVER' ? driverTrainingComplete :
    c==='TC' ? Boolean(user.trainingTcAt) :
    Boolean(user.trainingDispatcherAt)
  );

  const pendingDriverCheckRide = tab==='DRIVER' && driverTrainingComplete && !driverCheckRideComplete;

  useEffect(()=>{
    if (isDone(tab)) setPhase('done');
  },[tab, user]);

  async function complete(){
    setBusy(true);
    try{
      const r = await fetch('/api/training/complete', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ category: tab }) });
      if (!r.ok){
        // Try to extract meaningful server error
        const raw = await r.text();
        let msg = 'failed';
        try{
          const d = JSON.parse(raw);
          if (typeof d === 'string') msg = d;
          else if (Array.isArray(d)) msg = d.map((x:any)=> x?.message || x?.error).filter(Boolean).join('; ') || raw;
          else msg = d?.error || raw || 'failed';
        }catch{ msg = raw || 'failed'; }
        throw new Error(msg);
      }
      const d = await r.json();
      setUser((u:any)=> ({ ...u, ...d.user }));
      setPhase('done');
    }catch(e:any){ showToast(`Failed: ${e?.message||'Unknown error'}`); }
    finally{ setBusy(false); }
  }

  // Single tab UI across all breakpoints; dropdown removed per request

  return (
    <PageShell pad={false}>
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10">
        {/* Unified tab bar (mobile style) for all viewports */}
        <div className="glass rounded-[32px] border border-white/20 p-5 shadow-lg dark:border-white/10">
          <div className="text-sm opacity-70 mb-2">Training</div>
          <nav className="overflow-x-auto">
            <ul className="flex gap-2 pb-2">
              {ORDER.map(c=>{
                const active = tab===c; const locked = !canAccess(c);
                return (
                  <li key={c}>
                    <button
                      disabled={locked}
                    onClick={()=> setTab(c)}
                    className={`px-3 py-1.5 text-sm rounded-full border ${active ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'bg-transparent hover:bg-black/5 dark:hover:bg-white/10 border-black/10 dark:border-white/20'} ${locked? 'opacity-40 cursor-not-allowed':''}`}
                  >
                    {LABEL[c]} {isDone(c)&& <span className="text-xs opacity-70">(Done)</span>}
                  </button>
                </li>
              );
            })}
            </ul>
          </nav>
        </div>

        <div>
          {!canAccess(tab) ? (
            <div className="glass rounded-[28px] border border-white/20 p-5 text-sm opacity-80 shadow-lg dark:border-white/10">Your role does not permit this training. Select your role’s tab.</div>
          ) : (
            <div className="grid gap-4">
              {phase==='video' && (
                <section className="glass grid gap-3 rounded-[32px] border border-white/20 p-5 shadow-lg dark:border-white/10">
                  <YouTubeRequired videoId={VIDEOS[tab]} onFinished={()=> setWatched(true)} />
                  <div className="flex flex-wrap items-center gap-2">
                    <button disabled={!watched || busy} onClick={async()=>{ await complete(); showToast('Temporary training completed'); }} className="rounded px-4 py-2 border disabled:opacity-50">{busy ? 'Saving…' : 'Mark Training Complete'}</button>
                    {!watched && <span className="text-xs opacity-70">Watch the full video to enable.</span>}
                    {tab==='DRIVER' && <span className="text-xs opacity-70">Driver also requires Check Ride.</span>}
                  </div>
                </section>
              )}

              {phase==='done' && (
                <section className="glass rounded-[28px] border border-white/20 bg-green-400/10 p-5 text-green-700 shadow-lg dark:border-white/10 dark:bg-green-900/20 dark:text-green-300">
                  <div>
                    {pendingDriverCheckRide ? (
                      <>
                        <div>Driver training complete.</div>
                        <div className="text-sm opacity-80">A Check Ride is still required before you can access shifts.</div>
                      </>
                    ) : (
                      <>Training complete for {LABEL[tab]}. You may now access Shifts.</>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
        {/* Dropdown removed per request */}
      </div>
    </PageShell>
  );
}
