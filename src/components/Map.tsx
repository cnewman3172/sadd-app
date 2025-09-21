"use client";
import { useEffect, useRef } from 'react';

type Marker = { lat:number; lng:number; color?:string };

export default function Map({ height=300, markers=[] }: { height?: number, markers: Marker[] }){
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  useEffect(()=>{
    (async()=>{
      const L = await import('leaflet');
      // @ts-expect-error CSS types not declared
      await import('leaflet/dist/leaflet.css');
      if (!ref.current) return;
      if (!mapRef.current){
        mapRef.current = L.map(ref.current).setView([64.8378,-147.7164], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapRef.current);
      }
      if (!layerRef.current){
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }
      // Clear and redraw markers
      layerRef.current.clearLayers();
      markers.forEach(m=> L.circleMarker([m.lat, m.lng], { radius:6, color: m.color||'blue' }).addTo(layerRef.current));
      if (markers.length>0){
        const bounds = L.latLngBounds(markers.map(m=> [m.lat, m.lng] as [number, number]));
        mapRef.current.fitBounds(bounds.pad(0.3));
      }
    })();
  }, [markers]);

  return <div ref={ref} style={{height}} className="w-full" />
}
