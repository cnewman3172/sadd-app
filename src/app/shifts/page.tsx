"use client";
import { useEffect, useMemo, useState } from 'react';

type ShiftItem = { id:string; title?:string|null; role:'COORDINATOR'|'TC'; startsAt:string; endsAt:string; needed:number; signupCount:number; isSigned:boolean };

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
      if (!r.ok){ const d = await r.json().catch(()=>({error:'failed'})); alert(d.error||'Failed'); }
      await load();
    }finally{ setBusy(null); }
  }

  const groups = useMemo(()=>{
    const coord = items.filter(i=> i.role==='COORDINATOR');
    const tc = items.filter(i=> i.role==='TC');
    return { coord, tc };
  },[items]);

  return (
    <div className="mx-auto max-w-5xl p-4 grid gap-6">
      {groups.coord.length>0 && (
        <section>
          <h2 className="font-semibold mb-2">Coordinator Shifts</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {groups.coord.map(s=> (
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
      <div className="font-medium">{s.title || (s.role==='COORDINATOR'?'Coordinator Shift':'Truck Commander Shift')}</div>
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

