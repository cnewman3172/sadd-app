"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

type U = { id:string; email:string; firstName:string; lastName:string; role:string };

export default function AdminTraining(){
  const [users, setUsers] = useState<U[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(query?: string){
    setLoading(true);
    try{
      const url = query ? `/api/admin/users?q=${encodeURIComponent(query)}&includeDisabled=1` : '/api/admin/users?includeDisabled=1';
      const d = await fetch(url, { cache:'no-store' }).then(r=>r.json());
      setUsers(Array.isArray(d)? d : []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{ load(); },[]);

  return (
    <section className="p-4 rounded-xl glass border">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h1 className="text-xl font-semibold">Training</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input value={q} onChange={(e)=> setQ(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') load(q); }} placeholder="Search user" className="flex-1 sm:flex-none min-w-0 p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm" />
          <button onClick={()=> load(q)} className="rounded border px-3 py-2 text-sm whitespace-nowrap">Search</button>
        </div>
      </div>
      <div className="grid gap-2">
        {loading && <div className="text-sm opacity-70">Loading…</div>}
        {!loading && users.length===0 && <div className="text-sm opacity-70">No users.</div>}
        <ul className="divide-y divide-white/15 rounded-xl overflow-hidden border">
          {users.map(u=> (
            <li key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white/60 dark:bg-white/5">
              <div className="min-w-0">
                <div className="font-medium truncate">{u.firstName} {u.lastName}</div>
                <div className="text-xs opacity-70 truncate">{u.email} • {u.role}</div>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/executives/training/${u.id}`} className="rounded border px-3 py-2 text-sm">View</Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
