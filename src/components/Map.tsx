"use client";
import { useEffect, useRef } from 'react';

type Marker = { lat:number; lng:number; color?:string };
type VanMarker = { id:string; lat:number; lng:number; color:string };

export default function Map({ height=300, markers=[], vanMarkers=[], pickups=[], drops=[], polylines=[], onVanClick }: {
  height?: number,
  markers?: Marker[],
  vanMarkers?: VanMarker[],
  pickups?: Array<{lat:number,lng:number}>,
  drops?: Array<{lat:number,lng:number}>,
  polylines?: Array<Array<[number,number]>>,
  onVanClick?: (id:string)=>void,
}){
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const vansRef = useRef<any>(null);
  const poiRef = useRef<any>(null);
  const routeRef = useRef<any>(null);

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
      if (!layerRef.current){ layerRef.current = L.layerGroup().addTo(mapRef.current); }
      if (!vansRef.current){ vansRef.current = L.layerGroup().addTo(mapRef.current); }
      if (!poiRef.current){ poiRef.current = L.layerGroup().addTo(mapRef.current); }
      if (!routeRef.current){ routeRef.current = L.layerGroup().addTo(mapRef.current); }

      // Clear and redraw generic markers
      layerRef.current.clearLayers();
      markers.forEach(m=> L.circleMarker([m.lat, m.lng], { radius:6, color: m.color||'blue' }).addTo(layerRef.current));

      // Vans
      vansRef.current.clearLayers();
      vanMarkers.forEach(v=> {
        const mk = L.circleMarker([v.lat, v.lng], { radius:7, color: v.color, weight:2, fill:true, fillColor: v.color, fillOpacity:0.7 }).addTo(vansRef.current);
        if (onVanClick){ mk.on('click', ()=> onVanClick(v.id)); }
      });

      // POIs
      poiRef.current.clearLayers();
      pickups.forEach(p=> L.circleMarker([p.lat,p.lng], { radius:5, color:'red', weight:2, fill:true, fillColor:'red', fillOpacity:0.9 }).addTo(poiRef.current));
      const houseIcon = L.divIcon({ html: '<span style="font-size:18px;line-height:18px;color:#2563eb">🏠</span>', className: '' });
      drops.forEach(d=> L.marker([d.lat,d.lng], { icon: houseIcon }).addTo(poiRef.current));

      // Routes
      routeRef.current.clearLayers();
      polylines.forEach(coords=> L.polyline(coords, { color:'#2563eb', weight:3, opacity:0.8 }).addTo(routeRef.current));

      const allBounds = [
        ...markers.map(m=> [m.lat,m.lng] as [number,number]),
        ...vanMarkers.map(v=> [v.lat,v.lng] as [number,number]),
        ...pickups.map(p=> [p.lat,p.lng] as [number,number]),
        ...drops.map(d=> [d.lat,d.lng] as [number,number]),
      ];
      if (allBounds.length>0){
        const bounds = L.latLngBounds(allBounds);
        mapRef.current.fitBounds(bounds.pad(0.3));
      }
    })();
  }, [markers, vanMarkers, pickups, drops, polylines]);

  return <div ref={ref} style={{height}} className="w-full" />
}
