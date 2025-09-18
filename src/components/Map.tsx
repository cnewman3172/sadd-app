"use client";
import { useEffect, useRef } from 'react';

export default function Map({ height=300, markers=[] }: { height?: number, markers: Array<{lat:number,lng:number,color?:string}> }){
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    (async()=>{
      const L = await import('leaflet');
      // @ts-ignore
      await import('leaflet/dist/leaflet.css');
      if (!ref.current) return;
      const map = L.map(ref.current).setView([64.8378,-147.7164], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      markers.forEach(m=> L.circleMarker([m.lat,m.lng], { radius:6, color: m.color||'blue' }).addTo(map));
    })();
  },[markers]);
  return <div ref={ref} style={{height}} className="w-full" />
}

