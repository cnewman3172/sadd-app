"use client";
import { useEffect, useState } from 'react';
import { showToast } from '@/components/Toast';
import PageShell from '@/components/PageShell';

export default function Login() {
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [form, setForm] = useState<any>({});
  const [error, setError] = useState<string | null>(null);

  // If already logged in, skip login and redirect to role home
  useEffect(()=>{
    (async()=>{
      try{
        const r = await fetch('/api/me', { cache:'no-store' });
        if (r.ok){
          const u = await r.json();
          const dest: Record<string,string> = { ADMIN: '/executives', DISPATCHER: '/dashboard', TC: '/driving', DRIVER: '/shifts', SAFETY: '/shifts', RIDER: '/request' };
          window.location.replace(dest[u.role] || '/');
        }
      }catch{}
    })();
  },[]);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/auth/login', { method: 'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(form) });
    if (res.ok) {
      const data = await res.json();
      const role = data.role as string;
      const dest: Record<string,string> = { ADMIN: '/executives', DISPATCHER: '/dashboard', TC: '/driving', DRIVER: '/shifts', SAFETY: '/shifts', RIDER: '/request' };
      window.location.href = dest[role] || '/';
    } else {
      const data = await res.json().catch(()=>({ error: 'Login failed' }));
      setError(data.error || 'Login failed');
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/auth/register', { method: 'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(form) });
    if (res.ok) setMode('login');
    else {
      const data = await res.json().catch(()=>({ error: 'Registration failed' }));
      setError(data.error || 'Registration failed');
    }
  }

  return (
    <PageShell innerClassName="grid place-items-center" widthClassName="max-w-6xl" pad>
      <div className="w-full max-w-md glass rounded-[32px] border border-white/20 p-6 shadow-xl dark:border-white/10 sm:p-8">
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        {mode === 'login' ? (
          <form onSubmit={submitLogin} className="space-y-3">
            <h1 className="text-xl font-semibold">Login</h1>
            <input className="w-full p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="Email" type="email" onChange={(e)=>setForm({...form, email:e.target.value})} required />
            <input className="w-full p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="Password" type="password" onChange={(e)=>setForm({...form, password:e.target.value})} required />
            <button className="w-full rounded bg-black text-white py-3">Login</button>
            <button type="button" onClick={()=>setMode('register')} className="w-full rounded border py-3">Create account</button>
            <button
              type="button"
              onClick={async ()=>{
                const email = form?.email;
                if (!email) { setError('Enter your email above first.'); return; }
                const res = await fetch('/api/auth/forgot', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email }) });
                if (res.ok){
                  const d = await res.json().catch(()=>({}));
                  if (d?.link){
                    // Dev helper: if server returned a reset link, open it for convenience
                    try{ window.open(d.link, '_blank'); }catch{}
                  }
                  showToast('If the email exists, you will receive reset instructions.');
                } else {
                  setError('Please try again later.');
                }
              }}
              className="w-full text-sm underline"
            >Forgot password?</button>
          </form>
        ) : (
          <form onSubmit={submitRegister} className="space-y-3">
            <h1 className="text-xl font-semibold">Register</h1>
            <div className="grid grid-cols-2 gap-2">
              <input className="p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="First Name" onChange={(e)=>setForm({...form, firstName:e.target.value})} required />
              <input className="p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="Last Name" onChange={(e)=>setForm({...form, lastName:e.target.value})} required />
            </div>
            <input className="w-full p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="Rank" onChange={(e)=>setForm({...form, rank:e.target.value})} />
            <input className="w-full p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="Unit" onChange={(e)=>setForm({...form, unit:e.target.value})} />
            <input className="w-full p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="Phone" onChange={(e)=>setForm({...form, phone:e.target.value})} />
            <input className="w-full p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="Email" type="email" onChange={(e)=>setForm({...form, email:e.target.value})} required />
            <input className="w-full p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="Password" type="password" onChange={(e)=>setForm({...form, password:e.target.value})} required />
            <button className="w-full rounded bg-black text-white py-3">Register</button>
            <button type="button" onClick={()=>setMode('login')} className="w-full rounded border py-3">Back to login</button>
          </form>
        )}
      </div>
    </PageShell>
  );
}
