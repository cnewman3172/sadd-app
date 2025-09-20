"use client";
import { useState } from 'react';

export default function Login() {
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [form, setForm] = useState<any>({});
  const [error, setError] = useState<string | null>(null);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/auth/login', { method: 'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(form) });
    if (res.ok) {
      const data = await res.json();
      const role = data.role as string;
      const dest: Record<string,string> = { ADMIN: '/executives', COORDINATOR: '/dashboard', TC: '/driving', RIDER: '/request' };
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
    <div className="min-h-[70vh] grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl p-6 bg-white/60 dark:bg-white/10 backdrop-blur border border-white/20">
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        {mode === 'login' ? (
          <form onSubmit={submitLogin} className="space-y-3">
            <h1 className="text-xl font-semibold">Login</h1>
            <input className="w-full p-3 rounded border bg-white/80" placeholder="Email" type="email" onChange={(e)=>setForm({...form, email:e.target.value})} required />
            <input className="w-full p-3 rounded border bg-white/80" placeholder="Password" type="password" onChange={(e)=>setForm({...form, password:e.target.value})} required />
            <button className="w-full rounded bg-black text-white py-3">Login</button>
            <button type="button" onClick={()=>setMode('register')} className="w-full rounded border py-3">Create account</button>
            <button
              type="button"
              onClick={async ()=>{
                const email = form?.email;
                if (!email) { setError('Enter your email above first.'); return; }
                const res = await fetch('/api/auth/forgot', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email }) });
                if (res.ok) alert('If the email exists, you will receive reset instructions.');
                else setError('Please try again later.');
              }}
              className="w-full text-sm underline"
            >Forgot password?</button>
          </form>
        ) : (
          <form onSubmit={submitRegister} className="space-y-3">
            <h1 className="text-xl font-semibold">Register</h1>
            <div className="grid grid-cols-2 gap-2">
              <input className="p-3 rounded border bg-white/80" placeholder="First Name" onChange={(e)=>setForm({...form, firstName:e.target.value})} required />
              <input className="p-3 rounded border bg-white/80" placeholder="Last Name" onChange={(e)=>setForm({...form, lastName:e.target.value})} required />
            </div>
            <input className="w-full p-3 rounded border bg-white/80" placeholder="Rank" onChange={(e)=>setForm({...form, rank:e.target.value})} />
            <input className="w-full p-3 rounded border bg-white/80" placeholder="Unit" onChange={(e)=>setForm({...form, unit:e.target.value})} />
            <input className="w-full p-3 rounded border bg-white/80" placeholder="Phone" onChange={(e)=>setForm({...form, phone:e.target.value})} />
            <input className="w-full p-3 rounded border bg-white/80" placeholder="Email" type="email" onChange={(e)=>setForm({...form, email:e.target.value})} required />
            <input className="w-full p-3 rounded border bg-white/80" placeholder="Password" type="password" onChange={(e)=>setForm({...form, password:e.target.value})} required />
            <button className="w-full rounded bg-black text-white py-3">Register</button>
            <button type="button" onClick={()=>setMode('login')} className="w-full rounded border py-3">Back to login</button>
          </form>
        )}
      </div>
    </div>
  );
}
