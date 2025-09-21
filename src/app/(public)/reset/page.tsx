"use client";
import { useEffect, useState } from 'react';

export default function ResetPage(){
  const [token, setToken] = useState('');
  const [valid, setValid] = useState<boolean|null>(null);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string|undefined>(undefined);

  useEffect(()=>{
    const t = new URLSearchParams(window.location.search).get('token') || '';
    setToken(t);
    (async()=>{
      if (!t) { setValid(false); return; }
      const r = await fetch(`/api/auth/reset?token=${encodeURIComponent(t)}`);
      const d = await r.json();
      setValid(Boolean(d.ok));
    })();
  },[]);

  async function submit(e: React.FormEvent){
    e.preventDefault(); setMsg(undefined);
    if (pw1 !== pw2){ setMsg('Passwords do not match'); return; }
    if (pw1.length < 8){ setMsg('Password must be at least 8 characters'); return; }
    setBusy(true);
    try{
      const r = await fetch('/api/auth/reset', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ token, password: pw1 }) });
      if (!r.ok){ const d = await r.json().catch(()=>({error:'failed'})); throw new Error(d.error||'failed'); }
      setMsg('Password updated. You can now log in.');
    }catch(e:any){ setMsg(e.message||'Failed'); }
    finally{ setBusy(false); }
  }

  return (
    <div className="min-h-[70vh] grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl p-6 bg-white/60 dark:bg-white/10 backdrop-blur border border-white/20">
        <h1 className="text-xl font-semibold mb-2">Reset Password</h1>
        {valid===null && <div>Checking link…</div>}
        {valid===false && <div className="text-sm text-red-600">This reset link is invalid or expired.</div>}
        {valid && (
          <form onSubmit={submit} className="space-y-3">
            <input type="password" className="w-full p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="New password" value={pw1} onChange={(e)=> setPw1(e.target.value)} />
            <input type="password" className="w-full p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white" placeholder="Confirm new password" value={pw2} onChange={(e)=> setPw2(e.target.value)} />
            <button disabled={busy} className="w-full rounded bg-black text-white py-3">Update Password</button>
            {msg && <div className="text-sm mt-1">{msg}</div>}
          </form>
        )}
      </div>
    </div>
  );
}

