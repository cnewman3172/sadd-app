"use client";
import { useEffect, useRef } from 'react';

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  widthClassName?: string;
  pad?: boolean;
  showOrbs?: boolean;
  scrollEffects?: boolean;
};

function AmbientBackdrop({ animate = true }:{ animate?: boolean }){
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if (!animate || typeof window === 'undefined') return;
    const root = containerRef.current;
    if (!root) return;
    const orbs = Array.from(root.querySelectorAll('[data-orb]')) as HTMLElement[];
    if (orbs.length===0) return;
    const handle = ()=>{
      const { scrollY, innerHeight } = window;
      const center = scrollY + innerHeight / 2;
      orbs.forEach(el => {
        const speed = Number(el.dataset.speed || '0.1');
        const rect = el.getBoundingClientRect();
        const offset = (rect.top + scrollY - center) * speed;
        el.style.transform = `translate3d(0, ${offset}px, 0)`;
      });
    };
    const onScroll = ()=> window.requestAnimationFrame(handle);
    handle();
    window.addEventListener('scroll', onScroll, { passive: true });
    return ()=> window.removeEventListener('scroll', onScroll);
  }, [animate]);

  return (
    <div ref={containerRef} aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div data-orb data-speed="0.08" className="absolute -left-24 -top-24">
        <div className="orb orb-bg1 h-80 w-80" />
      </div>
      <div data-orb data-speed="0.12" className="absolute -right-36 top-0">
        <div className="orb orb-bg2 h-96 w-96" style={{ animationDelay: '-4s' }} />
      </div>
      <div data-orb data-speed="0.1" className="absolute left-[-10%] bottom-[-20%]">
        <div className="orb orb-bg3 h-[28rem] w-[28rem]" style={{ animationDuration: '18s' }} />
      </div>
    </div>
  );
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function PageShell({
  children,
  className,
  innerClassName,
  widthClassName = 'max-w-6xl',
  pad = true,
  showOrbs = true,
}: PageShellProps){
  return (
    <div className={cx('relative min-h-screen ambient-bg', className)}>
      {showOrbs ? <AmbientBackdrop /> : null}
      <div className={cx('relative z-10 mx-auto w-full', widthClassName, pad && 'px-4 py-12', innerClassName)}>
        {children}
      </div>
    </div>
  );
}
