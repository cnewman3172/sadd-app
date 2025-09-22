"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { showToast } from '@/components/Toast';
import ThemeToggle from '@/components/ThemeToggle';
import Dropdown from '@/components/Dropdown';

type User = { id:string; firstName?:string; lastName?:string; role?: 'ADMIN'|'COORDINATOR'|'TC'|'VOLUNTEER'|'RIDER' };

const LINKS: Array<{ href:string; label:string; roles: User['role'][] }> = [
  { href:'/executives', label:'Executives', roles:['ADMIN'] },
  { href:'/dashboard', label:'Coordinators', roles:['ADMIN','COORDINATOR'] },
  { href:'/driving', label:'Truck Commanders', roles:['ADMIN','COORDINATOR','TC'] },
  { href:'/shifts', label:'Shifts', roles:['ADMIN','COORDINATOR','TC','VOLUNTEER'] },
  { href:'/request', label:'Request a Ride', roles:['ADMIN','COORDINATOR','TC','VOLUNTEER','RIDER'] },
];

export default function TopNav(){
  const [user, setUser] = useState<User|null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement|null>(null);
  const acctBtnRef = useRef<HTMLButtonElement|null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{top:number;left:number;right:number;bottom:number;width:number;height:number}|null>(null);
  const [acctAnchor, setAcctAnchor] = useState<{top:number;left:number;right:number;bottom:number;width:number;height:number}|null>(null);
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
  useEffect(()=>{
    if (menuOpen && menuBtnRef.current){ setMenuAnchor(menuBtnRef.current.getBoundingClientRect()); }
    if (acctOpen && acctBtnRef.current){ setAcctAnchor(acctBtnRef.current.getBoundingClientRect()); }
    const onResize = ()=>{
      if (menuOpen && menuBtnRef.current){ setMenuAnchor(menuBtnRef.current.getBoundingClientRect()); }
      if (acctOpen && acctBtnRef.current){ setAcctAnchor(acctBtnRef.current.getBoundingClientRect()); }
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, { passive:true });
    return ()=>{ window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onResize); };
  },[menuOpen, acctOpen]);
  const name = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Account' : 'Account';
  const links = (user?.role ? LINKS.filter(l=> l.roles.includes(user.role!)) : []).filter((v,i,a)=> a.findIndex(x=>x.href===v.href)===i);
  return (
    <header className="sticky top-0 z-[1200]">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between rounded-b-2xl glass border border-white/20">
        <Link href="/" className="font-extrabold tracking-tight text-lg">SADD</Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user && (
            <div className="relative">
              <button ref={menuBtnRef} onClick={()=>{ setMenuOpen(o=>!o); setAcctOpen(false); }} className="rounded-full px-3 py-1 text-sm glass border border-white/20">Menu</button>
              <Dropdown open={menuOpen} anchor={menuAnchor} onClose={()=> setMenuOpen(false)}>
                {links.map(l=> (
                  <Link key={l.href} href={l.href} className="block px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10" onClick={()=> setMenuOpen(false)}>{l.label}</Link>
                ))}
              </Dropdown>
            </div>
          )}
          <div className="relative">
            <button ref={acctBtnRef} onClick={()=>{ setAcctOpen(o=>!o); setMenuOpen(false); }} className="rounded-full glass border border-white/20 px-3 py-1 text-sm">{name||'Account'}</button>
            <Dropdown open={acctOpen} anchor={acctAnchor} onClose={()=> setAcctOpen(false)}>
              <Link href="/profile" className="block px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10" onClick={()=> setAcctOpen(false)}>Settings</Link>
              <button className="block w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10" onClick={async()=>{ await fetch('/api/auth/logout',{ method:'POST' }); window.location.href='/login'; }}>Logout</button>
            </Dropdown>
          </div>
        </div>
      </div>
    </header>
  );
}
