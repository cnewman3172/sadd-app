"use client";
import { useEffect, useState } from 'react';
import Tabs from '@/app/executives/tabs';

type Shift = { id:string; title?:string|null; role:'COORDINATOR'|'TC'; startsAt:string; endsAt:string; needed:number; _count?:{ signups:number } };

export default function ExecShifts(){
  const [items, setItems] = useState<Shift[]>([]);
  const [form, setForm] = useState<{ title:string; role:'COORDINATOR'|'TC'; date:string; start:string; end:string; needed:number }>({ title:'', role:'COORDINATOR', date:'', start:'20:00', end:'23:00', needed:2 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState<{ title:string; date:string; start:string; end:string; needs:{ COORDINATOR:number; TC:number; VOLUNTEER:number } }>({ title:'', date:'', start:'20:00', end:'23:00', needs:{ COORDINATOR:0, TC:0, VOLUNTEER:0 } });

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
      const res = await fetch('/api/admin/shifts', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title: form.title||undefined, role: form.role, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), needed: form.needed }) });
      if (!res.ok){ const d = await res.json().catch(()=>({error:'failed'})); throw new Error(d.error||'failed'); }
      setForm({ title:'', role:'COORDINATOR', date:'', start:'20:00', end:'23:00', needed:2 });
      load();
    }catch(e:any){ setErr(e.message||'failed'); }
    finally{ setBusy(false); }
  }

  async function del(id:string){ if (!confirm('Delete this shift?')) return; await fetch(`/api/admin/shifts/${id}`, { method:'DELETE' }); load(); }

  return (
    <section className="rounded-xl p-4 glass border">
      <Tabs />
      <h2 className="font-semibold my-3">Shifts</h2>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm opacity-70">Create single-role or multi-role shifts.</div>
        <button type="button" className="rounded border px-3 py-1" onClick={()=> setBulkOpen(true)}>Create Multiple Roles…</button>
      </div>
      <form onSubmit={create} className="grid md:grid-cols-6 gap-2 items-end mb-4">
        <div>
          <label className="text-xs">Role</label>
          <select className="w-full p-2 rounded border glass" value={form.role} onChange={e=> setForm(f=>({...f, role: e.target.value as any}))}>
            <option value="COORDINATOR">Coordinator</option>
            <option value="TC">Truck Commander</option>
          </select>
        </div>
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
              <th className="px-2">Role</th>
              <th className="px-2">Title</th>
              <th className="px-2">Needed</th>
              <th className="px-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(s=> (
              <tr key={s.id} className="border-t border-white/20">
                <td className="py-2 px-2">{fmtRange(s.startsAt,s.endsAt)}</td>
                <td className="px-2">{s.role==='COORDINATOR'?'Coordinator':'Truck Commander'}</td>
                <td className="px-2">{s.title||'—'}</td>
                <td className="px-2">{s._count?.signups ?? 0} / {s.needed}</td>
                <td className="px-2 text-right"><button onClick={()=>del(s.id)} className="rounded border px-3 py-1">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BulkModal open={bulkOpen} onClose={()=> setBulkOpen(false)} bulk={bulk} setBulk={setBulk} onCreated={load} />
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

// Mount modal at end
export function ExecShiftsWithModalWrapper(){
  return <ExecShifts />;
}

function BulkModal({ open, onClose, bulk, setBulk, onCreated }:{ open:boolean; onClose:()=>void; bulk:any; setBulk:(u:any)=>void; onCreated:()=>void }){
  if (!open) return null;
  async function submit(e: React.FormEvent){
    e.preventDefault();
    try{
      if (!bulk.date) throw new Error('Pick a date');
      const startsAt = new Date(`${bulk.date}T${bulk.start}:00`).toISOString();
      const endsAt = new Date(`${bulk.date}T${bulk.end}:00`).toISOString();
      const res = await fetch('/api/admin/shifts/bulk', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title: bulk.title||undefined, startsAt, endsAt, needs: bulk.needs }) });
      if (!res.ok){ const d = await res.json().catch(()=>({error:'failed'})); throw new Error(d.error||'failed'); }
      onCreated();
      onClose();
    }catch(e:any){ alert(e.message||'Failed'); }
  }
  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-xl rounded-xl glass border p-4 grid md:grid-cols-4 gap-2">
        <div className="md:col-span-4 text-lg font-semibold mb-2">Create Multi-Role Shifts</div>
        <div className="md:col-span-4"><label className="text-xs">Title</label><input className="w-full p-2 rounded border glass" value={bulk.title} onChange={e=> setBulk((b:any)=>({ ...b, title: e.target.value }))} placeholder="Optional" /></div>
        <div><label className="text-xs">Date</label><input type="date" className="w-full p-2 rounded border glass" value={bulk.date} onChange={e=> setBulk((b:any)=>({ ...b, date: e.target.value }))} required /></div>
        <div><label className="text-xs">Start</label><input type="time" className="w-full p-2 rounded border glass" value={bulk.start} onChange={e=> setBulk((b:any)=>({ ...b, start: e.target.value }))} required /></div>
        <div><label className="text-xs">End</label><input type="time" className="w-full p-2 rounded border glass" value={bulk.end} onChange={e=> setBulk((b:any)=>({ ...b, end: e.target.value }))} required /></div>
        <div></div>
        <div><label className="text-xs">Coordinators Needed</label><input type="number" min={0} max={10} value={bulk.needs.COORDINATOR} onChange={e=> setBulk((b:any)=>({ ...b, needs: { ...b.needs, COORDINATOR: Number(e.target.value) } }))} className="w-full p-2 rounded border glass" /></div>
        <div><label className="text-xs">Truck Commanders Needed</label><input type="number" min={0} max={10} value={bulk.needs.TC} onChange={e=> setBulk((b:any)=>({ ...b, needs: { ...b.needs, TC: Number(e.target.value) } }))} className="w-full p-2 rounded border glass" /></div>
        <div><label className="text-xs">Volunteers Needed</label><input type="number" min={0} max={10} value={bulk.needs.VOLUNTEER} onChange={e=> setBulk((b:any)=>({ ...b, needs: { ...b.needs, VOLUNTEER: Number(e.target.value) } }))} className="w-full p-2 rounded border glass" /></div>
        <div className="md:col-span-4 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="rounded border px-3 py-1">Cancel</button>
          <button className="btn-primary">Create</button>
        </div>
        <div className="md:col-span-4 text-xs opacity-70">Overnight supported: if End is earlier than Start, it rolls to the next day.</div>
      </form>
    </div>
  );
}
