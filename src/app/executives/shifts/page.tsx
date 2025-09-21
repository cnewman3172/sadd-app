"use client";
import { useEffect, useState } from 'react';
import Tabs from '@/app/executives/tabs';

type Shift = { id:string; title?:string|null; startsAt:string; endsAt:string; needed:number; _count?:{ signups:number } };

export default function ExecShifts(){
  const [items, setItems] = useState<Shift[]>([]);
  const [form, setForm] = useState<{ title:string; date:string; start:string; end:string; needed:number }>({ title:'', date:'', start:'20:00', end:'23:00', needed:2 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  async function load(){
    const r = await fetch('/api/admin/shifts', { cache:'no-store' });
    if (r.ok){ setItems(await r.json()); }
  }
  useEffect(()=>{ load(); },[]);

  async function create(e: React.FormEvent){
    e.preventDefault(); setBusy(true); setErr(null);
    try{
      if (!form.date) throw new Error('Pick a date');
      const startsAt = new Date(`${form.date}T${form.start}:00`);
      let endsAt = new Date(`${form.date}T${form.end}:00`);
      // Overnight convenience: if end is earlier than start, roll to next day
      if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24*60*60*1000);
      const res = await fetch('/api/admin/shifts', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title: form.title||undefined, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), needed: form.needed }) });
      if (!res.ok){ const d = await res.json().catch(()=>({error:'failed'})); throw new Error(d.error||'failed'); }
      setForm({ title:'', date:'', start:'20:00', end:'23:00', needed:2 });
      load();
    }catch(e:any){ setErr(e.message||'failed'); }
    finally{ setBusy(false); }
  }

  async function del(id:string){ if (!confirm('Delete this shift?')) return; await fetch(`/api/admin/shifts/${id}`, { method:'DELETE' }); load(); }

  return (
    <section className="rounded-xl p-4 glass border">
      <Tabs />
      <h2 className="font-semibold my-3">Coordinator Shifts</h2>
      <form onSubmit={create} className="grid md:grid-cols-5 gap-2 items-end mb-4">
        <div><label className="text-xs">Title</label><input className="w-full p-2 rounded border glass" value={form.title} onChange={e=> setForm(f=>({...f,title:e.target.value}))} placeholder="Optional" /></div>
        <div><label className="text-xs">Date</label><input type="date" className="w-full p-2 rounded border glass" value={form.date} onChange={e=> setForm(f=>({...f,date:e.target.value}))} required /></div>
        <div><label className="text-xs">Start</label><input type="time" className="w-full p-2 rounded border glass" value={form.start} onChange={e=> setForm(f=>({...f,start:e.target.value}))} required /></div>
        <div><label className="text-xs">End</label><input type="time" className="w-full p-2 rounded border glass" value={form.end} onChange={e=> setForm(f=>({...f,end:e.target.value}))} required /></div>
        <div><label className="text-xs">Needed</label><input type="number" min={1} max={10} className="w-full p-2 rounded border glass" value={form.needed} onChange={e=> setForm(f=>({...f,needed:Number(e.target.value)}))} /></div>
        <button className="btn-primary" disabled={busy}>{busy?'Creating…':'Create Shift'}</button>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <div className="text-xs opacity-70 md:col-span-5">Overnight supported: if End is earlier than Start, it rolls to the next day.</div>
      </form>

      <div className="rounded-xl glass border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left opacity-70">
              <th className="py-2 px-2">When</th>
              <th className="px-2">Title</th>
              <th className="px-2">Needed</th>
              <th className="px-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(s=> (
              <tr key={s.id} className="border-t border-white/20">
                <td className="py-2 px-2">{fmtRange(s.startsAt,s.endsAt)}</td>
                <td className="px-2">{s.title||'—'}</td>
                <td className="px-2">{s._count?.signups ?? 0} / {s.needed}</td>
                <td className="px-2 text-right"><button onClick={()=>del(s.id)} className="rounded border px-3 py-1">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
