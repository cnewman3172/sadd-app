"use client";
import { useEffect, useState } from 'react';

export default function Profile() {
  const [form, setForm] = useState<any>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(()=>{
    fetch('/api/me').then(r=>r.json()).then((u)=>{ setForm(u); setLoaded(true); });
  },[]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/me', { method:'PUT', body: JSON.stringify(form) });
    alert('Saved');
  }

  async function changePassword() {
    const current = prompt('Current password');
    const next = prompt('New password');
    if (!current || !next) return;
    const res = await fetch('/api/auth/change-password', { method:'POST', body: JSON.stringify({current, next}) });
    alert(res.ok ? 'Password changed' : 'Failed');
  }

  if (!loaded) return <div className="p-6">Loading…</div>;
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <form onSubmit={save} className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <input className="p-3 rounded border bg-white/80" value={form.firstName||''} onChange={(e)=>setForm({...form, firstName:e.target.value})} />
          <input className="p-3 rounded border bg-white/80" value={form.lastName||''} onChange={(e)=>setForm({...form, lastName:e.target.value})} />
        </div>
        <input className="p-3 rounded border bg-white/80" value={form.rank||''} onChange={(e)=>setForm({...form, rank:e.target.value})} />
        <input className="p-3 rounded border bg-white/80" value={form.unit||''} onChange={(e)=>setForm({...form, unit:e.target.value})} />
        <input className="p-3 rounded border bg-white/80" value={form.phone||''} onChange={(e)=>setForm({...form, phone:e.target.value})} />
        <button className="rounded bg-black text-white py-3">Save</button>
      </form>
      <button onClick={changePassword} className="rounded border py-2 px-4">Change Password</button>
    </div>
  );
}

