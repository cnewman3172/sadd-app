"use client";
import { useEffect, useState } from 'react';

type Theme = 'light'|'dark'|'system';

export default function ThemeToggle(){
  const [theme, setTheme] = useState<Theme>(()=>{
    if (typeof document === 'undefined') return 'system';
    const cookie = (document.cookie||'').split('; ').find(x=>x.startsWith('theme='))?.split('=')[1] as Theme|undefined;
    if (cookie==='dark' || cookie==='light' || cookie==='system') return cookie;
    return 'system';
  });

  useEffect(()=>{
    const html = document.documentElement;
    const expires = new Date(Date.now()+365*24*60*60*1000).toUTCString();
    if (theme==='system'){
      html.removeAttribute('data-theme');
    }else{
      html.setAttribute('data-theme', theme);
    }
    document.cookie = `theme=${theme}; path=/; expires=${expires}; samesite=lax`;
  },[theme]);

  const label = theme==='system' ? 'System' : theme==='dark' ? 'Dark' : 'Light';
  const next = theme==='light' ? 'dark' : theme==='dark' ? 'system' : 'light';
  const nextLabel = next==='system' ? 'System mode' : (next==='dark' ? 'Dark mode' : 'Light mode');
  const icon = theme==='system' ? '🖥️' : theme==='dark' ? '🌙' : '☀️';
  return (
    <button
      aria-label={`Switch theme (current: ${label})`}
      className="rounded-full glass border border-white/20 px-3 py-1 text-sm"
      onClick={()=> setTheme(next)}
      title={`Switch to ${nextLabel}`}
    >
      {icon}
    </button>
  );
}
