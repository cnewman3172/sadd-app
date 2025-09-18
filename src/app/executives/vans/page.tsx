"use client";
import { useEffect, useState } from 'react';

type Van = { id: string; name: string; capacity: number; status: string };

export default function Vans(){
  const [vans, setVans] = useState<Van[]>([]);
  const [form, setForm] = useState({ name: '', capacity: 8 });

  async function refresh(){
    const v = await fetch('/api/vans').then(r=>r.json());
    setVans(v);
  }
  useEffect(()=>{ refresh(); },[]);

  async function addVan(e: React.FormEvent){
    e.preventDefault();
    const res = await fetch('/api/vans', { method:'POST', body: JSON.stringify(form) });
    if (res.ok){ setForm({ name:'', capacity:8 }); refresh(); }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Fleet</h1>
      <form onSubmit={addVan} className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20 grid grid-cols-3 gap-2">
        <input className="p-2 rounded border col-span-2" placeholder="Van name" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} />
        <input className="p-2 rounded border" type="number" min={1} placeholder="Capacity" value={form.capacity} onChange={(e)=>setForm({...form, capacity:Number(e.target.value)})} />
        <button className="rounded bg-black text-white py-2 col-span-3">Add Van</button>
      </form>
      <div className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left opacity-70">
              <th className="py-2">Name</th>
              <th>Capacity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {vans.map(v=> (
              <tr key={v.id} className="border-t border-white/20">
                <td className="py-2">{v.name}</td>
                <td>{v.capacity}</td>
                <td>{v.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

