"use client";
import { useEffect } from 'react';

export default function ScrollEffects(){
  useEffect(()=>{
    // Reveal on scroll
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if (e.isIntersecting){
          e.target.classList.add('is-visible');
          // Once visible, stop observing for performance
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
    els.forEach(el=> io.observe(el));

    // Soft parallax for orb wrappers
    const orbs = Array.from(document.querySelectorAll<HTMLElement>('[data-orb]'));
    const onScroll = ()=>{
      const y = window.scrollY;
      orbs.forEach(el=>{
        const speed = Number(el.dataset.speed || '0.12');
        const dy = Math.round(y * speed);
        el.style.transform = `translate3d(0, ${dy}px, 0)`;
      });
      // Gradient sheen progress for elements
      const sheens = Array.from(document.querySelectorAll<HTMLElement>('[data-sheen]'));
      sheens.forEach(el=>{
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const visible = Math.min(1, Math.max(0, 1 - rect.top/vh * 0.8));
        const pos = -120 + visible * 240; // -120% to +120%
        el.style.setProperty('--shine', `${pos}%`);
      });
    };
    const onMove = (ev: MouseEvent)=>{
      const { innerWidth: w, innerHeight: h } = window;
      const nx = (ev.clientX - w/2) / (w/2);
      const ny = (ev.clientY - h/2) / (h/2);
      orbs.forEach(el=>{
        const speed = Number(el.dataset.speed || '0.12');
        const x = Math.round(nx * 10 * speed);
        const y = Math.round(ny * 10 * speed);
        // combine with scroll translateY already applied above
        el.style.transform += ` translateX(${x}px) translateY(${y}px)`;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });
    return ()=>{
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMove);
    };
  },[]);
  return null;
}
