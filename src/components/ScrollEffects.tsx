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
    let normX = 0, normY = 0, scrollY = 0;
    const applyParallax = ()=>{
      orbs.forEach(el=>{
        const speed = Number(el.dataset.speed || '0.12');
        const dx = Math.round(normX * 10 * speed);
        const dy = Math.round((scrollY * speed) + (normY * 10 * speed));
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      });
    };
    const onScroll = ()=>{
      scrollY = window.scrollY;
      applyParallax();
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
      normX = (ev.clientX - w/2) / (w/2);
      normY = (ev.clientY - h/2) / (h/2);
      applyParallax();
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
