"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import YouTubeRequired from '@/components/YouTubeRequired';

type Cat = 'SAFETY'|'DRIVER'|'TC'|'DISPATCHER';
const ORDER: Cat[] = ['SAFETY','DRIVER','TC','DISPATCHER'];
const LABEL: Record<Cat,string> = { SAFETY:'Safety', DRIVER:'Driver', TC:'Truck Commander', DISPATCHER:'Dispatcher' };
const VIDEOS: Record<Cat,string> = {
  SAFETY: 'dQw4w9WgXcQ', // placeholder
  DRIVER: 'dQw4w9WgXcQ',
  TC: 'dQw4w9WgXcQ',
  DISPATCHER: 'dQw4w9WgXcQ',
};

export default function Training(){
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Cat>('SAFETY');
  const [phase, setPhase] = useState<'video'|'quiz'|'done'>('video');
  const [watched, setWatched] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(()=>{ fetch('/api/me', { cache:'no-store' }).then(r=>r.json()).then(setUser).catch(()=>{}); },[]);
  useEffect(()=>{ setPhase('video'); setWatched(false); setAnswered(false); },[tab]);

  const role: Cat | null = useMemo(()=>{
    switch(user?.role){ case 'SAFETY': return 'SAFETY'; case 'DRIVER': return 'DRIVER'; case 'TC': return 'TC'; case 'DISPATCHER': return 'DISPATCHER'; default: return null; }
  },[user]);

  const canAccess = (c: Cat)=> user?.role==='ADMIN' || role===c;
  const isDone = (c: Cat)=> !!user && (
    c==='SAFETY' ? Boolean(user.trainingSafetyAt) :
    c==='DRIVER' ? Boolean(user.trainingDriverAt) && Boolean(user.checkRide) :
    c==='TC' ? Boolean(user.trainingTcAt) :
    Boolean(user.trainingDispatcherAt)
  );

  async function complete(){
    setBusy(true);
    try{
      const r = await fetch('/api/training/complete', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ category: tab }) });
      if (!r.ok){ const d = await r.json().catch(()=>({error:'failed'})); throw new Error(d.error||'failed'); }
      const d = await r.json();
      setUser((u:any)=> ({ ...u, ...d.user }));
      setPhase('done');
    }catch(e:any){ alert(e.message||'Failed'); }
    finally{ setBusy(false); }
  }

  // Mobile dropdown state (kept as dropdown design)
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect|null>(null);
  const btnRef = useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{
    if (!menuOpen) return;
    const onPos = ()=>{ if (btnRef.current) setMenuAnchor(btnRef.current.getBoundingClientRect()); };
    window.addEventListener('resize', onPos);
    window.addEventListener('scroll', onPos, { passive:true });
    onPos();
    return ()=>{ window.removeEventListener('resize', onPos); window.removeEventListener('scroll', onPos); };
  },[menuOpen]);

  return (
    <div className="mx-auto max-w-6xl p-4 grid gap-4">
      {/* Desktop: tab bar like admin panel */}
      <nav className="hidden md:block border-b border-black/10 dark:border-white/20 overflow-x-auto">
        <ul className="flex gap-2">
          {ORDER.map(c=>{
            const active = tab===c; const locked = !canAccess(c);
            return (
              <li key={c}>
                <button
                  disabled={locked}
                  onClick={()=> setTab(c)}
                  className={`inline-block px-3 py-2 text-sm rounded-t ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-black/5 dark:hover:bg-white/10'} ${locked? 'opacity-40 cursor-not-allowed':''}`}
                >
                  {LABEL[c]} {isDone(c)&& <span className="text-xs opacity-70">(Done)</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile: keep dropdown menu design */}
      <div className="md:hidden">
        <div className="flex items-center justify-between">
          <div className="text-sm opacity-70">Training</div>
          <div className="relative">
            <button
              ref={btnRef}
              onClick={()=>{ setMenuOpen(o=>{ const next = !o; if (next && btnRef.current) setMenuAnchor(btnRef.current.getBoundingClientRect()); return next; }); }}
              className="rounded-full px-3 py-1 text-sm glass border border-white/20"
            >
              {LABEL[tab]}
            </button>
          </div>
        </div>
      </div>

      <div>
        {!canAccess(tab) ? (
          <div className="rounded border p-4 text-sm opacity-80">Your role does not permit this training. Select your role’s tab.</div>
        ) : (
          <div className="grid gap-4">
            {phase==='video' && (
              <section className="grid gap-3">
                <YouTubeRequired videoId={VIDEOS[tab]} onFinished={()=> setWatched(true)} />
                <div className="flex items-center gap-2">
                  <button disabled={!watched} onClick={()=> setPhase('quiz')} className="rounded px-4 py-2 border disabled:opacity-50">{watched ? 'Begin Test' : 'Watch video to continue'}</button>
                  {tab==='DRIVER' && <span className="text-xs opacity-70">Driver also requires Check Ride.</span>}
                </div>
              </section>
            )}

            {phase==='quiz' && (
              <section className="rounded border p-3">
                <div className="font-medium mb-2">Quick Check</div>
                <div className="text-sm mb-2">What is the safe following distance?</div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm"><input type="radio" name="q1" onChange={()=> setAnswered(false)} /> 1 second</label>
                  <label className="text-sm"><input type="radio" name="q1" onChange={()=> setAnswered(true)} /> 3 seconds</label>
                  <label className="text-sm"><input type="radio" name="q1" onChange={()=> setAnswered(false)} /> 0.5 seconds</label>
                </div>
                <button disabled={!answered || busy} onClick={complete} className="mt-3 btn-primary">{busy ? 'Saving…' : 'Mark Complete'}</button>
              </section>
            )}

            {phase==='done' && (
              <section className="rounded border p-4 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                Training complete for {LABEL[tab]}. You may now access Shifts.
              </section>
            )}
          </div>
        )}
      </div>
      {/* Mobile dropdown menu content */}
      {menuOpen && menuAnchor && (
        // use dynamic import-less inline dropdown to avoid circular import; reuse .popover styles
        <div className="md:hidden fixed inset-0 z-[1500]" onClick={()=> setMenuOpen(false)}>
          <div className="absolute right-4" style={{ top: (menuAnchor as any).bottom + 8 }} onClick={(e)=> e.stopPropagation()}>
            <div className="w-56 rounded-xl popover">
              {ORDER.map(c=>{
                const locked = !canAccess(c);
                const active = tab===c;
                return (
                  <button
                    key={c}
                    disabled={locked}
                    onClick={()=>{ if (!locked){ setTab(c); setMenuOpen(false); } }}
                    className={`block w-full text-left px-3 py-2 text-sm ${active? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-black/5 dark:hover:bg-white/10'} ${locked? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {LABEL[c]} {isDone(c)&& '✔'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
