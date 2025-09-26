"use client";
import React from 'react';

export function LineChart({ points, height=120, color='#111', fill=false, yMax, className='' }:{ points: Array<{ x:number; y:number }>; height?:number; color?:string; fill?:boolean; yMax?:number; className?:string }){
  const width = Math.max(240, points.length * 16);
  const maxY = yMax ?? Math.max(1, ...points.map(p=>p.y));
  const minY = 0;
  const xs = points.map((p,i)=> i/(points.length-1 || 1));
  const path = points.map((p,i)=>{
    const x = Math.round(xs[i]*width);
    const y = Math.round(height - (p.y-minY)/(maxY-minY||1) * height);
    return `${i===0?'M':'L'}${x},${y}`;
  }).join(' ');
  const area = `${path} L${width},${height} L0,${height} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      {fill && <path d={area} fill={hexWithAlpha(color,0.15)} />}
      <path d={path} stroke={color} strokeWidth={2} fill="none" />
    </svg>
  );
}

export function BarChart({ bars, height=120, color='#111', className='' }:{ bars: Array<{ label:string; value:number }>; height?:number; color?:string; className?:string }){
  const max = Math.max(1, ...bars.map(b=>b.value));
  const width = Math.max(240, bars.length * 18);
  const barW = Math.floor(width / Math.max(1,bars.length)) - 4;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      {bars.map((b,i)=>{
        const x = i*(barW+4);
        const h = Math.round((b.value/max) * (height-14));
        const y = height - h;
        return <g key={i}>
          <rect x={x} y={y} width={barW} height={h} fill={hexWithAlpha(color,0.2)} stroke={color} />
        </g>;
      })}
    </svg>
  );
}

function hexWithAlpha(hex:string, alpha:number){
  if (hex.startsWith('#') && (hex.length===4 || hex.length===7)){
    const n = hex.length===4 ? parseInt(hex.slice(1).split('').map(c=>c+c).join(''),16) : parseInt(hex.slice(1),16);
    const r = (n>>16)&255, g=(n>>8)&255, b=n&255; return `rgba(${r},${g},${b},${alpha})`;
  }
  return hex;
}

