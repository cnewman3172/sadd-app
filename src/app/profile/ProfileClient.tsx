"use client";
import { useEffect, useState } from 'react';
import { showToast } from '@/components/Toast';
import PageShell from '@/components/PageShell';

export default function ProfileClient() {
  const [form, setForm] = useState<any>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(()=>{
    fetch('/api/me').then(r=>r.json()).then((u)=>{ setForm(u); setLoaded(true); });
  },[]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/me', { method:'PUT', body: JSON.stringify(form) });
    if (r.ok) showToast('Saved'); else showToast('Failed to save');
  }

  async function changePassword() {
    const current = prompt('Current password');
    const next = prompt('New password');
    if (!current || !next) return;
    const res = await fetch('/api/auth/change-password', { method:'POST', body: JSON.stringify({current, next}) });
    showToast(res.ok ? 'Password changed' : 'Failed to change password');
  }

  if (!loaded) return (
    <PageShell>
      <div className="glass mx-auto max-w-3xl rounded-[32px] border border-white/20 p-6 shadow-lg dark:border-white/10 sm:p-8">
        Loading…
      </div>
    </PageShell>
  );
  return (
    <PageShell>
      <div className="glass mx-auto max-w-3xl space-y-4 rounded-[32px] border border-white/20 p-6 shadow-lg dark:border-white/10 sm:p-8">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <form onSubmit={save} className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <input className="p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" value={form.firstName||''} onChange={(e)=>setForm({...form, firstName:e.target.value})} />
          <input className="p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" value={form.lastName||''} onChange={(e)=>setForm({...form, lastName:e.target.value})} />
        </div>
        <input className="p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" value={form.rank||''} onChange={(e)=>setForm({...form, rank:e.target.value})} />
        <input className="p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" value={form.unit||''} onChange={(e)=>setForm({...form, unit:e.target.value})} />
        <input className="p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" value={form.phone||''} onChange={(e)=>setForm({...form, phone:e.target.value})} />
        {/* Check Ride completion is managed by executives, not editable here */}
        <button className="rounded bg-black text-white py-3">Save</button>
      </form>
      <button onClick={changePassword} className="rounded border py-2 px-4">Change Password</button>

      {/* Training access moved to Account dropdown in the header */}
      </div>
    </PageShell>
  );
}
