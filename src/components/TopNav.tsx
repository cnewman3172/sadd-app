"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import Dropdown from '@/components/Dropdown';
import useCurrentUser, { type CurrentUser } from '@/hooks/useCurrentUser';
import AccountMenuButton from '@/components/AccountMenuButton';

const LINKS: Array<{ href:string; label:string; roles: CurrentUser['role'][] }> = [
  { href:'/executives', label:'Executives', roles:['ADMIN'] },
  { href:'/dashboard', label:'Dispatch', roles:['ADMIN','DISPATCHER'] },
  { href:'/driving', label:'Truck Commanders', roles:['ADMIN','DISPATCHER','TC'] },
  { href:'/shifts', label:'Shifts', roles:['ADMIN','DISPATCHER','TC','DRIVER','SAFETY'] },
  { href:'/request', label:'Request a Ride', roles:['ADMIN','DISPATCHER','TC','DRIVER','SAFETY','RIDER'] },
];

export default function TopNav(){
  const { user } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement|null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{top:number;left:number;right:number;bottom:number;width:number;height:number}|null>(null);
  useEffect(()=>{
    if (menuOpen && menuBtnRef.current){ setMenuAnchor(menuBtnRef.current.getBoundingClientRect()); }
    const onResize = ()=>{
      if (menuOpen && menuBtnRef.current){ setMenuAnchor(menuBtnRef.current.getBoundingClientRect()); }
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, { passive:true });
    return ()=>{ window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onResize); };
  },[menuOpen]);
  const links = (user?.role ? LINKS.filter(l=> l.roles.includes(user.role!)) : []).filter((v,i,a)=> a.findIndex(x=>x.href===v.href)===i);
  const [accountCloseSignal, setAccountCloseSignal] = useState(0);
  return (
    <header className="sticky top-0 z-[1200]">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between rounded-b-2xl glass border border-white/20">
        <Link href="/" className="font-extrabold tracking-tight text-lg">SADD</Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user && (
            <div className="relative">
              <button ref={menuBtnRef} onClick={()=>{ setMenuOpen(o=>!o); setAccountCloseSignal(s=>s+1); }} className="rounded-full px-3 py-1 text-sm glass border border-white/20">Menu</button>
              <Dropdown open={menuOpen} anchor={menuAnchor} onClose={()=> setMenuOpen(false)}>
                {links.map(l=> (
                  <Link key={l.href} href={l.href} className="block px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10" onClick={()=> setMenuOpen(false)}>{l.label}</Link>
                ))}
              </Dropdown>
            </div>
          )}
          <AccountMenuButton
            user={user}
            closeSignal={accountCloseSignal}
            onOpenChange={(open)=>{ if (open) setMenuOpen(false); }}
          />
        </div>
      </div>
    </header>
  );
}
