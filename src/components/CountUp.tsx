"use client";
import { useEffect, useRef, useState } from 'react';

export default function CountUp({ value, durationMs=1200, suffix='', placeholder='—' }: { value: number|null|undefined; durationMs?: number; suffix?: string; placeholder?: string }){
  const [display, setDisplay] = useState(0);
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(()=>{
    if (value==null || !isFinite(value)) return; // nothing to animate
    const el = ref.current;
    if (!el) return;
    let started = false;
    const start = ()=>{
      if (started) return; started = true;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (durationMs<=0 || reduce){ setDisplay(value); setReady(true); return; }
      const from = 0; const to = Math.max(0, Math.round(value));
      const t0 = performance.now();
      const ease = (t:number)=> 1 - Math.pow(1 - t, 3); // easeOutCubic
      const step = ()=>{
        const p = Math.min(1, (performance.now()-t0) / durationMs);
        const cur = Math.round(from + (to-from)*ease(p));
        setDisplay(cur);
        if (p<1) requestAnimationFrame(step); else setReady(true);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if (e.isIntersecting) { start(); io.disconnect(); } });
    }, { threshold: .2 });
    io.observe(el);
    return ()=> io.disconnect();
  }, [value, durationMs]);

  if (value==null || !isFinite(value)) return <span ref={ref}>{placeholder}</span>;
  return <span ref={ref} aria-live={ready? 'off':'polite'}>{display.toLocaleString()}<span className="opacity-80">{suffix}</span></span>;
}

