"use client";
import { useEffect, useState } from 'react';
import type { Van } from '@/types';

export default function Fleet(){
  const [vans, setVans] = useState<Van[]>([]);
  const [form, setForm] = useState<{ name:string; capacity:number }>({ name:'', capacity:8 });
  const [error, setError] = useState<string|null>(null);
  const [actionError, setActionError] = useState<string|null>(null);

  async function refresh(){
    const r = await fetch('/api/vans');
    setVans(await r.json());
  }
  useEffect(()=>{ refresh(); },[]);

  async function createVan(e: React.FormEvent){
    e.preventDefault(); setError(null);
    const res = await fetch('/api/vans', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(form) });
    if (!res.ok){ const d = await res.json().catch(()=>({error:'failed'})); setError(d.error||'Create failed'); return; }
    setForm({ name:'', capacity:8 });
    refresh();
  }

  async function updateVan(id:string, patch: Partial<Van>){
    setActionError(null);
    const res = await fetch(`/api/vans/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(patch) });
    if (res.ok){
      refresh();
    }else{
      const d = await res.json().catch(()=>({ error:'Update failed' }));
      setActionError(d.error || 'Update failed');
    }
  }

  async function delVan(id:string){
    if (!confirm('Delete this van?')) return;
    const res = await fetch(`/api/vans/${id}`, { method:'DELETE' });
    if (res.ok) refresh();
  }

  async function forceOffline(id: string){
    if (!confirm('Force this van offline? This will clear its controller and active tasks.')) return;
    await updateVan(id, { status: 'OFFLINE' });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={createVan} className="rounded-xl p-4 bg-white text-black dark:bg-neutral-900 dark:text-white border border-black/10 dark:border-white/20 grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <div>
          <label className="text-sm">Name</label>
          <input className="w-full p-2 rounded border" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} required />
        </div>
        <div>
          <label className="text-sm">Capacity</label>
          <input type="number" min={1} max={16} className="w-full p-2 rounded border" value={form.capacity} onChange={(e)=>setForm({...form, capacity:Number(e.target.value)})} />
        </div>
        <button className="rounded bg-black text-white px-4 py-2 dark:bg-white dark:text-black">Add Van</button>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>

      <div className="rounded-xl p-4 bg-white text-black dark:bg-neutral-900 dark:text-white border border-black/10 dark:border-white/20 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left opacity-70">
              <th className="py-2">Name</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>Operator</th>
              <th>Passengers</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vans.map(v=> (
              <tr key={v.id} className="border-t border-black/10 dark:border-white/20">
                <td className="py-2">
                  <input className="p-1 rounded border bg-white/90 dark:bg-neutral-800" defaultValue={v.name} onBlur={(e)=> updateVan(v.id,{ name:e.target.value })} />
                </td>
                <td>
                  <input type="number" min={1} max={16} className="w-24 p-1 rounded border bg-white/90 dark:bg-neutral-800" defaultValue={v.capacity} onBlur={(e)=> updateVan(v.id,{ capacity:Number(e.target.value) })} />
                </td>
                <td>
                  <select className="p-1 rounded border bg-white/90 dark:bg-neutral-800" defaultValue={v.status} onChange={(e)=> updateVan(v.id,{ status:e.target.value as Van['status'] })}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="OFFLINE">OFFLINE</option>
                  </select>
                </td>
                <td>
                  {v.activeTcId ? (
                    <div className="text-sm">
                      <div>{[v.activeTc?.firstName, v.activeTc?.lastName].filter(Boolean).join(' ') || 'Assigned'}</div>
                      <div className="text-xs opacity-70">{v.activeTc?.email || '—'}</div>
                    </div>
                  ) : (
                    <span className="text-xs opacity-60">Unassigned</span>
                  )}
                </td>
                <td>{v.passengers ?? 0}</td>
                <td className="text-right space-x-2 whitespace-nowrap">
                  <button onClick={()=>forceOffline(v.id)} className="rounded border px-3 py-1 text-sm">Force Offline</button>
                  <button onClick={()=>delVan(v.id)} className="rounded border px-3 py-1 text-sm">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {actionError && <div className="mt-2 text-sm text-red-600">{actionError}</div>}
      </div>
    </div>
  );
}
