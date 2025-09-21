"use client";
import { useEffect, useState } from 'react';

type U = { id:string; email:string; firstName:string; lastName:string; role:string; createdAt:string };

export default function UsersPage(){
  const [users, setUsers] = useState<U[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  async function load(query?: string){
    setLoading(true);
    try{
      const url = query ? `/api/admin/users?q=${encodeURIComponent(query)}` : '/api/admin/users';
      const d = await fetch(url, { cache: 'no-store' }).then(r=>r.json());
      setUsers(d);
    } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); },[]);

  return (
    <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Users</h2>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e)=> setQ(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') load(q); }} placeholder="Search email or name" className="p-2 rounded border bg-white/80 dark:bg-neutral-800 text-sm text-black dark:text-white" />
          <button onClick={()=>load(q)} className="rounded border px-3 py-1 text-sm">Search</button>
        </div>
      </div>
      <div className="rounded-xl border border-white/20 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left opacity-70">
              <th className="py-2 px-2">Email</th>
              <th className="px-2">Name</th>
              <th className="px-2">Role</th>
              <th className="px-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u=> (
              <tr key={u.id} className="border-t border-white/20">
                <td className="py-2 px-2 whitespace-nowrap">{u.email}</td>
                <td className="px-2 whitespace-nowrap">{u.firstName} {u.lastName}</td>
                <td className="px-2">
                  <select defaultValue={u.role} className="p-1 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" onChange={async(e)=>{
                    const role = e.target.value;
                    const res = await fetch(`/api/admin/users/${u.id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ role }) });
                    if (!res.ok) { alert('Update failed'); (e.target as HTMLSelectElement).value = u.role; return; }
                    setUsers(prev=> prev.map(x=> x.id===u.id ? { ...x, role } : x));
                  }}>
                    <option value="ADMIN">ADMIN</option>
                    <option value="COORDINATOR">COORDINATOR</option>
                    <option value="TC">TC</option>
                    <option value="RIDER">RIDER</option>
                  </select>
                </td>
                <td className="px-2 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {users.length===0 && !loading && (
              <tr><td className="py-3 px-2 text-sm opacity-70" colSpan={4}>No users.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
