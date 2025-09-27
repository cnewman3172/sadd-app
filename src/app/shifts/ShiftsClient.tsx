"use client";
import { useEffect, useMemo, useState } from 'react';
import { showToast } from '@/components/Toast';

type ShiftItem = { id:string; title?:string|null; role:'DISPATCHER'|'TC'|'DRIVER'|'SAFETY'; startsAt:string; endsAt:string; needed:number; signupCount:number; isSigned:boolean };

export default function Shifts(){
  const [items, setItems] = useState<ShiftItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load(){
    const r = await fetch('/api/shifts', { cache:'no-store' });
    if (r.ok){ setItems(await r.json()); }
  }
  useEffect(()=>{ load(); },[]);

  async function toggle(id:string, on:boolean){
    setBusy(id);
    try{
      const r = await fetch(`/api/shifts/${id}/signup`, { method: on ? 'POST' : 'DELETE' });
      if (!r.ok){ const d = await r.json().catch(()=>({error:'failed'})); showToast(d.error||'Failed'); }
      await load();
    }finally{ setBusy(null); }
  }

  const groups = useMemo(()=>{
    const dispatch = items.filter(i=> i.role==='DISPATCHER');
    const tc = items.filter(i=> i.role==='TC');
    const driver = items.filter(i=> i.role==='DRIVER');
    const safety = items.filter(i=> i.role==='SAFETY');
    return { dispatch, tc, driver, safety };
  },[items]);

  return (
    <div className="mx-auto max-w-5xl p-4 grid gap-6">
      {groups.dispatch.length>0 && (
        <section>
          <h2 className="font-semibold mb-2">Dispatcher Shifts</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {groups.dispatch.map(s=> (
              <Card key={s.id} s={s} busy={busy===s.id} onToggle={toggle} />
            ))}
          </div>
        </section>
      )}

      {groups.tc.length>0 && (
        <section>
          <h2 className="font-semibold mb-2">Truck Commander Shifts</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {groups.tc.map(s=> (
              <Card key={s.id} s={s} busy={busy===s.id} onToggle={toggle} />)
            )}
          </div>
        </section>
      )}

      {groups.driver.length>0 && (
        <section>
          <h2 className="font-semibold mb-2">Driver Shifts</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {groups.driver.map(s=> (
              <Card key={s.id} s={s} busy={busy===s.id} onToggle={toggle} />)
            )}
          </div>
        </section>
      )}

      {groups.safety.length>0 && (
        <section>
          <h2 className="font-semibold mb-2">Safety Shifts</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {groups.safety.map(s=> (
              <Card key={s.id} s={s} busy={busy===s.id} onToggle={toggle} />)
            )}
          </div>
        </section>
      )}

      {items.length===0 && (
        <div className="opacity-70 text-sm">No shifts posted yet.</div>
      )}
    </div>
  );
}

function Card({ s, busy, onToggle }:{ s:ShiftItem; busy:boolean; onToggle:(id:string,on:boolean)=>void }){
  return (
    <div className="rounded-xl glass border p-4">
      <div className="text-sm opacity-80">{fmtRange(s.startsAt, s.endsAt)}</div>
      <div className="font-medium">{s.title || (s.role==='DISPATCHER'?'Dispatcher Shift': s.role==='TC'?'Truck Commander Shift': s.role==='DRIVER'?'Driver Shift':'Safety Shift')}</div>
      <div className="text-xs opacity-80 mb-2">Signed: {s.signupCount} / {s.needed}</div>
      <div className="flex gap-2">
        {!s.isSigned && s.signupCount < s.needed && (
          <button disabled={busy} onClick={()=>onToggle(s.id, true)} className="btn-primary">Sign Up</button>
        )}
        {s.isSigned && (
          <button disabled={busy} onClick={()=>onToggle(s.id, false)} className="rounded-full px-3 py-1 border">Withdraw</button>
        )}
        {s.signupCount >= s.needed && !s.isSigned && (
          <span className="text-xs opacity-70">Full</span>
        )}
      </div>
    </div>
  );
}

function fmtRange(a:string,b:string){
  try{
    const s = new Date(a); const e = new Date(b);
    const sameDay = s.toDateString() === e.toDateString();
    const dt = new Intl.DateTimeFormat(undefined, { dateStyle:'medium' }).format(s);
    const t = (d:Date)=> new Intl.DateTimeFormat(undefined, { hour:'numeric', minute:'2-digit' }).format(d);
    return sameDay ? `${dt} · ${t(s)} – ${t(e)}` : `${dt} ${t(s)} → ${new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(e)} ${t(e)}`;
  }catch{ return '—'; }
}
