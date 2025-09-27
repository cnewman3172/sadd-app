"use client";
import { useEffect, useState } from 'react';
import { showToast } from '@/components/Toast';
import Modal from '@/components/Modal';

type U = { id:string; email:string; firstName:string; lastName:string; role:string; createdAt:string };

export default function UsersPage(){
  const [users, setUsers] = useState<U[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<any|null>(null);
  const [editForm, setEditForm] = useState<any>({});

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
              <th className="px-2"></th>
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
                    if (!res.ok) { showToast('Update failed'); (e.target as HTMLSelectElement).value = u.role; return; }
                    setUsers(prev=> prev.map(x=> x.id===u.id ? { ...x, role } : x));
                  }}>
                    <option value="ADMIN">ADMIN</option>
                    <option value="DISPATCHER">DISPATCHER</option>
                    <option value="TC">TC</option>
                    <option value="DRIVER">DRIVER</option>
                    <option value="SAFETY">SAFETY</option>
                    <option value="RIDER">RIDER</option>
                  </select>
                </td>
                <td className="px-2 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-2 text-right">
                  <button className="rounded border px-2 py-1 text-xs" onClick={()=>{ setEditUser(u); setEditForm({ firstName: u.firstName||'', lastName: u.lastName||'', rank: (u as any).rank||'', unit: (u as any).unit||'', phone: (u as any).phone||'' }); setEditOpen(true); }}>Edit</button>
                </td>
              </tr>
            ))}
            {users.length===0 && !loading && (
              <tr><td className="py-3 px-2 text-sm opacity-70" colSpan={4}>No users.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <EditModal open={editOpen} onClose={()=> setEditOpen(false)} form={editForm} setForm={setEditForm} user={editUser} onSaved={(nu)=>{
        setUsers(prev=> prev.map(x=> x.id===nu.id ? { ...x, firstName: nu.firstName, lastName: nu.lastName } : x));
        setEditOpen(false);
      }} />
    </section>
  );
}

function EditModal({ open, onClose, form, setForm, user, onSaved }:{ open:boolean; onClose:()=>void; form:any; setForm:(u:any)=>void; user:any; onSaved:(u:any)=>void }){
  if (!open || !user) return null;
  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-4">
        <h3 className="font-semibold mb-3">Edit User</h3>
        <div className="grid gap-2">
          <div className="text-xs opacity-70">{user.email}</div>
          <div className="grid grid-cols-2 gap-2">
            <input className="p-2 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="First name" value={form.firstName||''} onChange={(e)=> setForm((f:any)=> ({ ...f, firstName: e.target.value }))} />
            <input className="p-2 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="Last name" value={form.lastName||''} onChange={(e)=> setForm((f:any)=> ({ ...f, lastName: e.target.value }))} />
          </div>
          <input className="p-2 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="Rank" value={form.rank||''} onChange={(e)=> setForm((f:any)=> ({ ...f, rank: e.target.value }))} />
          <input className="p-2 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="Unit" value={form.unit||''} onChange={(e)=> setForm((f:any)=> ({ ...f, unit: e.target.value }))} />
          <input className="p-2 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="Phone" value={form.phone||''} onChange={(e)=> setForm((f:any)=> ({ ...f, phone: e.target.value }))} />
          <div className="flex justify-end gap-2 mt-2">
            <button className="rounded border px-3 py-1 text-sm" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={async()=>{
              try{
                const res = await fetch(`/api/admin/users/${user.id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(form) });
                if (!res.ok){ const d = await res.json().catch(()=>({error:'failed'})); throw new Error(d.error||'Save failed'); }
                const updated = await res.json();
                onSaved({ ...user, ...form });
              }catch(e:any){ showToast(e?.message||'Save failed'); }
            }}>Save</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
