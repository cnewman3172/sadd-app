"use client";
import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';

type Shift = { id:string; title?:string|null; role:'DISPATCHER'|'TC'|'DRIVER'|'SAFETY'; startsAt:string; endsAt:string; needed:number; _count?:{ signups:number } };

export default function ExecShifts(){
  const [items, setItems] = useState<Shift[]>([]);
  const [viewing, setViewing] = useState<Shift|null>(null);
  const [signups, setSignups] = useState<Array<{ id:string; firstName:string; lastName:string; email:string; phone?:string|null; role:string }>>([]);
  const [loadingSignups, setLoadingSignups] = useState(false);
  // Single-role creation removed per request; use bulk modal instead
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState<{ title:string; date:string; start:string; end:string; needs:{ DISPATCHER:number; TC:number; DRIVER:number; SAFETY:number } }>({ title:'', date:'', start:'20:00', end:'23:00', needs:{ DISPATCHER:0, TC:0, DRIVER:0, SAFETY:0 } });

  async function load(){
    const r = await fetch('/api/admin/shifts', { cache:'no-store' });
    if (r.ok){ setItems(await r.json()); }
  }
  useEffect(()=>{ load(); },[]);

  async function del(id:string){ if (!confirm('Delete this shift?')) return; await fetch(`/api/admin/shifts/${id}`, { method:'DELETE' }); load(); }
  async function openSignups(s: Shift){
    setViewing(s);
    setLoadingSignups(true);
    try{
      const r = await fetch(`/api/admin/shifts/${s.id}/signups`, { cache:'no-store' });
      if (r.ok){
        const d = await r.json();
        setSignups(d.users||[]);
      } else { setSignups([]); }
    }catch{ setSignups([]); }
    finally{ setLoadingSignups(false); }
  }

  return (
    <section className="rounded-xl p-4 glass border">
      <h2 className="font-semibold my-3">Shifts</h2>
      <div className="flex items-center justify-end mb-2">
        <button type="button" className="rounded border px-3 py-1" onClick={()=> setBulkOpen(true)}>Create Shifts…</button>
      </div>

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
                <td className="px-2">{s.role==='DISPATCHER'?'Dispatcher': s.role==='TC'?'Truck Commander': s.role==='DRIVER'?'Driver':'Safety'}</td>
                <td className="px-2">{s.title||'—'}</td>
                <td className="px-2">{s._count?.signups ?? 0} / {s.needed}</td>
                <td className="px-2 text-right space-x-2">
                  <button onClick={()=> openSignups(s)} className="rounded border px-3 py-1">View</button>
                  <button onClick={()=>del(s.id)} className="rounded border px-3 py-1">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BulkModal open={bulkOpen} onClose={()=> setBulkOpen(false)} bulk={bulk} setBulk={setBulk} onCreated={load} />
      <SignupsModal open={!!viewing} onClose={()=>{ setViewing(null); setSignups([]); }} shift={viewing} signups={signups} loading={loadingSignups} />
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
    <Modal open={open} onClose={onClose}>
      <form onSubmit={submit} className="p-4 grid md:grid-cols-4 gap-2">
        <div className="md:col-span-4 text-lg font-semibold mb-2">Create Multi-Role Shifts</div>
        <div className="md:col-span-4"><label className="text-xs">Title</label><input className="w-full p-2 rounded border glass" value={bulk.title} onChange={e=> setBulk((b:any)=>({ ...b, title: e.target.value }))} placeholder="Optional" /></div>
        <div><label className="text-xs">Date</label><input type="date" className="w-full p-2 rounded border glass" value={bulk.date} onChange={e=> setBulk((b:any)=>({ ...b, date: e.target.value }))} required /></div>
        <div><label className="text-xs">Start</label><input type="time" className="w-full p-2 rounded border glass" value={bulk.start} onChange={e=> setBulk((b:any)=>({ ...b, start: e.target.value }))} required /></div>
        <div><label className="text-xs">End</label><input type="time" className="w-full p-2 rounded border glass" value={bulk.end} onChange={e=> setBulk((b:any)=>({ ...b, end: e.target.value }))} required /></div>
        <div></div>
        <div><label className="text-xs">Dispatchers</label><input type="number" min={0} max={10} value={bulk.needs.DISPATCHER} onChange={e=> setBulk((b:any)=>({ ...b, needs: { ...b.needs, DISPATCHER: Number(e.target.value) } }))} className="w-full p-2 rounded border glass" /></div>
        <div><label className="text-xs">Truck Commanders</label><input type="number" min={0} max={10} value={bulk.needs.TC} onChange={e=> setBulk((b:any)=>({ ...b, needs: { ...b.needs, TC: Number(e.target.value) } }))} className="w-full p-2 rounded border glass" /></div>
        <div><label className="text-xs">Drivers</label><input type="number" min={0} max={10} value={bulk.needs.DRIVER} onChange={e=> setBulk((b:any)=>({ ...b, needs: { ...b.needs, DRIVER: Number(e.target.value) } }))} className="w-full p-2 rounded border glass" /></div>
        <div><label className="text-xs">Safety</label><input type="number" min={0} max={10} value={bulk.needs.SAFETY} onChange={e=> setBulk((b:any)=>({ ...b, needs: { ...b.needs, SAFETY: Number(e.target.value) } }))} className="w-full p-2 rounded border glass" /></div>
        <div className="md:col-span-4 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="rounded border px-3 py-1">Cancel</button>
          <button className="btn-primary">Create</button>
        </div>
        <div className="md:col-span-4 text-xs opacity-70">Overnight supported: if End is earlier than Start, it rolls to the next day.</div>
      </form>
    </Modal>
  );
}

function SignupsModal({ open, onClose, shift, signups, loading }:{ open:boolean; onClose:()=>void; shift: Shift|null; signups: Array<{ id:string; firstName:string; lastName:string; email:string; phone?:string|null; role:string }>; loading:boolean }){
  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-4 min-w-[320px] max-w-[640px]">
        <div className="text-lg font-semibold mb-2">Signups {shift ? `· ${fmtRange(shift.startsAt, shift.endsAt)}` : ''}</div>
        {loading ? (
          <div className="py-6 opacity-70">Loading…</div>
        ) : (
          <div className="rounded-xl glass border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left opacity-70">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2">Role</th>
                  <th className="px-2">Email</th>
                  <th className="px-2">Phone</th>
                  <th className="px-2"></th>
                </tr>
              </thead>
              <tbody>
                {signups.length===0 ? (
                  <tr><td className="px-2 py-4" colSpan={5}>No one has signed up yet.</td></tr>
                ) : signups.map(u=> (
                  <tr key={u.id} className="border-t border-white/20">
                    <td className="px-2 py-1">{u.firstName} {u.lastName}</td>
                    <td className="px-2 py-1">{u.role}</td>
                    <td className="px-2 py-1">{u.email}</td>
                    <td className="px-2 py-1">{u.phone||'—'}</td>
                    <td className="px-2 py-1 text-right"><a className="rounded border px-3 py-1 inline-block" href={`/executives/users/${u.id}`}>View</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 text-right">
          <button className="rounded border px-3 py-1" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}
