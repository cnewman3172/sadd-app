import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

// Lightweight in-memory cache per process
type CacheEntry = { ts: number; body: any };
const cache = new Map<string, CacheEntry>();
const TTL_MS = Number(process.env.PLAN_ETA_TTL_MS || '8000');

function haversineMeters(lat1:number, lon1:number, lat2:number, lon2:number){
  const R = 6371000; const toRad = (d:number)=> d*Math.PI/180;
  const dLat = toRad(lat2-lat1); const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const vanId = url.searchParams.get('vanId') || '';
  const bust = url.searchParams.get('bust') === '1';
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','DISPATCHER','TC'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  if (!vanId) return NextResponse.json({ error:'vanId required' }, { status: 400 });

  // Serve from cache if fresh
  if (!bust){
    const ent = cache.get(vanId);
    if (ent && (Date.now() - ent.ts) < TTL_MS){
      return new NextResponse(JSON.stringify(ent.body), { status: 200, headers: { 'Content-Type':'application/json', 'Cache-Control': 'no-store' } });
    }
  }

  const van = await prisma.van.findUnique({ where:{ id: vanId } });
  if (!van || typeof van.currentLat!=='number' || typeof van.currentLng!=='number') return NextResponse.json({ error:'van location unknown' }, { status: 400 });
  const plan = await prisma.vanTask.findMany({ where:{ vanId }, orderBy:{ order:'asc' }, include:{ ride:true } });
  if (plan.length===0){
    const body = { tasks: [], etas: {} };
    cache.set(vanId, { ts: Date.now(), body });
    return NextResponse.json(body);
  }

  // Build coords with collapse of near-duplicate points
  const start:[number,number]=[van.currentLat, van.currentLng];
  const coords: Array<[number,number]> = [start, ...plan.map(p=> p.phase==='PICKUP' ? [p.ride.pickupLat, p.ride.pickupLng] as [number,number] : [p.ride.dropLat, p.ride.dropLng] as [number,number])];
  const filtered: Array<[number,number]> = [coords[0]];
  const mapIndex: number[] = [0];
  for (let i=1;i<coords.length;i++){
    const prev = filtered[filtered.length-1];
    const cur = coords[i];
    if (haversineMeters(prev[0],prev[1],cur[0],cur[1]) < 30){ mapIndex.push(filtered.length-1); continue; }
    filtered.push(cur); mapIndex.push(filtered.length-1);
  }
  const base = process.env.OSRM_URL || 'https://router.project-osrm.org';
  const pairs = filtered.map(([lat,lng])=> `${lng},${lat}`).join(';');
  const r = await fetch(`${base}/route/v1/driving/${pairs}?overview=false&steps=false&annotations=duration`);
  if (!r.ok) return NextResponse.json({ error:'osrm failed' }, { status: 502 });
  const data = await r.json();
  const route = data.routes?.[0];
  const legs: number[] = Array.isArray(route?.legs) ? route.legs.map((l:any)=> Number(l?.duration||0)) : [];
  const cum: number[] = [0];
  for (let i=0;i<legs.length;i++){ cum[i+1] = cum[i] + legs[i]; }

  // Build ETAs per ride
  const etas: Record<string, { toPickupSec: number|null; toDropSec: number|null }> = {};
  let idx = 1;
  for (const p of plan){
    const fIdx = mapIndex[idx];
    const t = cum[fIdx] ?? cum[idx] ?? null;
    const entry = etas[p.rideId] || { toPickupSec: null, toDropSec: null };
    if (p.phase === 'PICKUP') entry.toPickupSec = t;
    else entry.toDropSec = t;
    etas[p.rideId] = entry; idx += 1;
  }
  const tasks = plan.map(p=> ({ rideId: p.rideId, phase: p.phase, order: p.order }));
  const body = { tasks, etas };
  cache.set(vanId, { ts: Date.now(), body });
  return NextResponse.json(body);
}
