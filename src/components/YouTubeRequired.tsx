"use client";
import { useEffect, useRef, useState } from 'react';

declare global { interface Window { YT: any; onYouTubeIframeAPIReady: any; } }

export default function YouTubeRequired({ videoId, onFinished }:{ videoId: string; onFinished: ()=>void }){
  const elRef = useRef<HTMLDivElement|null>(null);
  const [ready, setReady] = useState(false);
  useEffect(()=>{
    let player: any;
    function ensureApi(){
      return new Promise<void>((resolve)=>{
        if (window.YT && window.YT.Player) return resolve();
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
        (window as any).onYouTubeIframeAPIReady = ()=> resolve();
      });
    }
    (async()=>{
      await ensureApi();
      if (!elRef.current) return;
      // eslint-disable-next-line new-cap
      player = new window.YT.Player(elRef.current, {
        height: '315', width: '560', videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { controls: 0, disablekb: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
        events: { onReady: ()=> setReady(true), onStateChange: (e:any)=>{ if (e.data === 0) onFinished(); } }
      });
    })();
    return ()=>{ try{ player?.destroy?.(); }catch{} };
  },[videoId]);
  return (
    <div className="relative">
      <div ref={elRef} className="w-full aspect-video bg-black rounded" />
      {!ready && <div className="absolute inset-0 grid place-items-center text-sm opacity-70">Loading…</div>}
    </div>
  );
}
