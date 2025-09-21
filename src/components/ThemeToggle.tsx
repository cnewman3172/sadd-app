"use client";
import { useEffect, useState } from 'react';

type Theme = 'light'|'dark';

export default function ThemeToggle(){
  const [theme, setTheme] = useState<Theme>(()=>{
    if (typeof document === 'undefined') return 'light';
    const cookie = (document.cookie||'').split('; ').find(x=>x.startsWith('theme='))?.split('=')[1] as Theme|undefined;
    if (cookie==='dark' || cookie==='light') return cookie;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });

  useEffect(()=>{
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    const expires = new Date(Date.now()+365*24*60*60*1000).toUTCString();
    document.cookie = `theme=${theme}; path=/; expires=${expires}; samesite=lax`;
  },[theme]);

  return (
    <button
      aria-label={theme==='dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rounded-full glass border border-white/20 px-3 py-1 text-sm"
      onClick={()=> setTheme(t=> t==='dark' ? 'light' : 'dark')}
      title={theme==='dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme==='dark' ? '☀️' : '🌙'}
    </button>
  );
}

