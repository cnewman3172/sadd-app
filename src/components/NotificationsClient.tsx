"use client";
import { useEffect } from 'react';
import { showToast } from '@/components/Toast';

function chime(){
  try{
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 880;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.start(); o.stop(ctx.currentTime + 0.55);
  }catch{}
}

export default function NotificationsClient(){
  useEffect(()=>{
    // Register SW
    if ('serviceWorker' in navigator){
      navigator.serviceWorker.register('/sw.js').catch(()=>{});
    }
    // Ask permission silently if already granted or default
    (async()=>{
      try{
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default'){
          // Not forcing prompt; leave to user action elsewhere if desired
        }
        if (Notification.permission === 'granted'){
          const vapid = await fetch('/api/push/key', { cache:'no-store' }).then(r=>r.json()).catch(()=>null);
          const pk = vapid?.publicKey || '';
          if (!pk) return;
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (!sub){
            const converted = urlBase64ToUint8Array(pk);
            const news = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: converted });
            await fetch('/api/push/subscribe', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ subscription: news }) });
          }
        }
      }catch{}
    })();

    // Foreground: SSE for real-time events
    const es = new EventSource('/api/stream');
    const onRide = (e: MessageEvent)=>{
      try{
        const d = JSON.parse(e.data||'{}');
        if (document.visibilityState === 'visible'){
          chime();
          showToast(`Ride #${d.code}: ${d.status}`);
        }
      }catch{}
    };
    es.addEventListener('ride:update', onRide);
    // SW messages → chime + toast
    const onMsg = (ev: MessageEvent)=>{
      const d = ev.data||{};
      if (d?.type === 'inapp_notify'){
        chime();
        showToast(d.title + (d.body? ` — ${d.body}`:''));
      }
    };
    navigator.serviceWorker?.addEventListener?.('message', onMsg as any);
    return ()=>{ try{ es.close(); }catch{} (navigator.serviceWorker as any)?.removeEventListener?.('message', onMsg as any); };
  },[]);
  return null;
}

function urlBase64ToUint8Array(base64String: string){
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}

