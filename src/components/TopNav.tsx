"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { showToast } from '@/components/Toast';

type User = { id:string; firstName?:string; lastName?:string; role?: 'ADMIN'|'COORDINATOR'|'TC'|'RIDER' };

const LINKS: Array<{ href:string; label:string; roles: User['role'][] }> = [
  { href:'/executives', label:'Executives', roles:['ADMIN'] },
  { href:'/dashboard', label:'Coordinators', roles:['ADMIN','COORDINATOR'] },
  { href:'/driving', label:'Truck Commanders', roles:['ADMIN','COORDINATOR','TC'] },
  { href:'/request', label:'Request a Ride', roles:['ADMIN','COORDINATOR','TC','RIDER'] },
];

export default function TopNav(){
  const [user, setUser] = useState<User|null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  useEffect(()=>{
    fetch('/api/me', { cache:'no-store' })
      .then(r=> r.ok ? r.json() : null)
      .then((u: any)=>{
        setUser(u as User|null);
        try{
          const prev = window.localStorage.getItem('sadd_role');
          if (u?.role){
            if (prev && prev !== u.role){ showToast('Permissions updated'); }
            window.localStorage.setItem('sadd_role', u.role);
          }
        }catch{}
      })
      .catch(()=>{});
  },[]);
  const name = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Account' : 'Account';
  const links = (user?.role ? LINKS.filter(l=> l.roles.includes(user.role!)) : []).filter((v,i,a)=> a.findIndex(x=>x.href===v.href)===i);
  return (
    <header className="sticky top-0 z-[1200]">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between rounded-b-2xl glass border border-white/20">
        <Link href="/" className="font-extrabold tracking-tight text-lg">SADD</Link>
        <div className="flex items-center gap-3">
          {user && (
            <div className="relative">
              <button onClick={()=>{ setMenuOpen(o=>!o); setAcctOpen(false); }} className="rounded-full px-3 py-1 text-sm glass border border-white/20">Menu</button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl glass border border-white/20 bg-white/60 dark:bg-white/10 shadow z-[1300]">
                  {links.map(l=> (
                    <Link key={l.href} href={l.href} className="block px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10" onClick={()=> setMenuOpen(false)}>{l.label}</Link>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="relative">
            <button onClick={()=>{ setAcctOpen(o=>!o); setMenuOpen(false); }} className="rounded-full glass border border-white/20 px-3 py-1 text-sm">{name||'Account'}</button>
            {acctOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl glass border border-white/20 bg-white/60 dark:bg-white/10 shadow z-[1300]">
                <Link href="/profile" className="block px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10" onClick={()=> setAcctOpen(false)}>Settings</Link>
                <button className="block w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10" onClick={async()=>{ await fetch('/api/auth/logout',{ method:'POST' }); window.location.href='/login'; }}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
