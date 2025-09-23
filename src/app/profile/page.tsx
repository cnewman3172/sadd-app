"use client";
import { useEffect, useState } from 'react';

export default function Profile() {
  const [form, setForm] = useState<any>({});
  const [loaded, setLoaded] = useState(false);
  const [training, setTraining] = useState<{ status: 'NOT_STARTED'|'IN_PROGRESS'|'COMPLETED'; lastUpdated?: string }>({ status: 'NOT_STARTED' });

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
          <input className="p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" value={form.firstName||''} onChange={(e)=>setForm({...form, firstName:e.target.value})} />
          <input className="p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" value={form.lastName||''} onChange={(e)=>setForm({...form, lastName:e.target.value})} />
        </div>
        <input className="p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" value={form.rank||''} onChange={(e)=>setForm({...form, rank:e.target.value})} />
        <input className="p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" value={form.unit||''} onChange={(e)=>setForm({...form, unit:e.target.value})} />
        <input className="p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" value={form.phone||''} onChange={(e)=>setForm({...form, phone:e.target.value})} />
        <button className="rounded bg-black text-white py-3">Save</button>
      </form>
      <button onClick={changePassword} className="rounded border py-2 px-4">Change Password</button>

      <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
        <h2 className="font-semibold mb-2">Training</h2>
        <div className="text-sm opacity-80 mb-3">Complete required training for your role. Progress and requirements will appear here.</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">Status: {training.status.replace('_',' ')}</div>
            {training.lastUpdated && <div className="text-xs opacity-70">Updated: {new Date(training.lastUpdated).toLocaleString()}</div>}
          </div>
          <div className="flex gap-2">
            <a href="/training" className="btn-primary">Open Training</a>
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={()=> alert('Training module coming soon.')}>Learn More</button>
          </div>
        </div>
      </section>
    </div>
  );
}
