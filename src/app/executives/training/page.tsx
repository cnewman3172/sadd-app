"use client";
import { useEffect, useState } from 'react';

type U = { id:string; email:string; firstName:string; lastName:string; role:string; checkRide?:boolean; trainingSafetyAt?:string|null; trainingDriverAt?:string|null; trainingTcAt?:string|null; trainingDispatcherAt?:string|null };

export default function AdminTraining(){
  const [users, setUsers] = useState<U[]>([]);
  const [busyId, setBusyId] = useState<string>('');
  const [q, setQ] = useState('');

  async function load(query?: string){
    const url = query ? `/api/admin/users?q=${encodeURIComponent(query)}&includeDisabled=1` : '/api/admin/users?includeDisabled=1';
    const d = await fetch(url, { cache:'no-store' }).then(r=>r.json());
    setUsers(d);
  }
  useEffect(()=>{ load(); },[]);

  async function save(u: U, changes: any){
    setBusyId(u.id);
    try{
      const res = await fetch(`/api/admin/users/${u.id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(changes) });
      if (!res.ok){ const d = await res.json().catch(()=>({error:'failed'})); throw new Error(d.error||'Save failed'); }
      await load(q);
    }catch(e:any){ alert(e.message||'Failed'); }
    finally{ setBusyId(''); }
  }

  return (
    <section className="p-4 rounded-xl glass border">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Training (Admin)</h1>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e)=> setQ(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') load(q); }} placeholder="Search user" className="p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm" />
          <button onClick={()=> load(q)} className="rounded border px-3 py-1 text-sm">Search</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left opacity-70">
              <th className="py-2 px-2">User</th>
              <th className="px-2">Role</th>
              <th className="px-2">Safety</th>
              <th className="px-2">Driver</th>
              <th className="px-2">TC</th>
              <th className="px-2">Dispatcher</th>
              <th className="px-2">Check Ride</th>
              <th className="px-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u=> (
              <tr key={u.id} className="border-t border-white/20">
                <td className="py-2 px-2 whitespace-nowrap">{u.firstName} {u.lastName} <span className="opacity-60">{u.email}</span></td>
                <td className="px-2">{u.role}</td>
                <td className="px-2"><input type="checkbox" defaultChecked={!!u.trainingSafetyAt} onChange={(e)=> save(u, { trainingSafety: e.target.checked })} /></td>
                <td className="px-2"><input type="checkbox" defaultChecked={!!u.trainingDriverAt} onChange={(e)=> save(u, { trainingDriver: e.target.checked })} /></td>
                <td className="px-2"><input type="checkbox" defaultChecked={!!u.trainingTcAt} onChange={(e)=> save(u, { trainingTc: e.target.checked })} /></td>
                <td className="px-2"><input type="checkbox" defaultChecked={!!u.trainingDispatcherAt} onChange={(e)=> save(u, { trainingDispatcher: e.target.checked })} /></td>
                <td className="px-2"><input type="checkbox" defaultChecked={!!u.checkRide} onChange={(e)=> save(u, { checkRide: e.target.checked })} /></td>
                <td className="px-2 text-right">{busyId===u.id && <span className="text-xs opacity-60">Saving…</span>}</td>
              </tr>
            ))}
            {users.length===0 && (
              <tr><td className="py-3 px-2 text-sm opacity-70" colSpan={8}>No users.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

