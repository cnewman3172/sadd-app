import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  pickup: z.string().regex(/^[-\d\.]+,[-\d\.]+$/),
  pax: z.coerce.number().int().min(1).max(11).default(1),
});

async function osrmLegs(coords: Array<[number,number]>)
{
  const base = process.env.OSRM_URL || 'https://router.project-osrm.org';
  const pairs = coords.map(([lat,lng])=> `${lng},${lat}`).join(';');
  try{
    const r = await fetch(`${base}/route/v1/driving/${pairs}?overview=false&alternatives=false&annotations=duration`);
    if (!r.ok) return null as null | number[];
    const d = await r.json();
    const legs: number[] = d?.routes?.[0]?.legs?.map((l:any)=> Number(l?.duration ?? 0)) ?? [];
    return legs;
  }catch{
    return null as null | number[];
  }
}

function haversineMeters(lat1:number, lon1:number, lat2:number, lon2:number){
  const R = 6371000; const toRad = (d:number)=> d*Math.PI/180;
  const dLat = toRad(lat2-lat1); const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export async function GET(req: Request){
  try{
    const url = new URL(req.url);
    const parsed = schema.safeParse({ pickup: url.searchParams.get('pickup') || '', pax: url.searchParams.get('pax') || '1' });
    const maxAgeMs = Number(url.searchParams.get('maxAgeMs') || process.env.VAN_LOCATION_MAX_AGE_MS || '60000');
    const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
    const payload = await verifyJwt(token);
    if (!payload) return NextResponse.json({ error:'forbidden' }, { status: 403 });
    if (!parsed.success) return NextResponse.json({ error:'pickup required' }, { status:400 });
    const [pLat, pLng] = parsed.data.pickup.split(',').map(Number);
    const pax = parsed.data.pax;

    const vans = await prisma.van.findMany({ where:{ status: { in: ['ACTIVE','MAINTENANCE'] } } });
    const tasksByVan = await prisma.ride.findMany({ where:{ status: { in:['ASSIGNED','EN_ROUTE','PICKED_UP'] } }, select:{ id:true, vanId:true, pickupLat:true, pickupLng:true, dropLat:true, dropLng:true } });

    let best: { vanId:string; name:string; secondsToPickup:number } | null = null;
    const fallbackSpeed = Number(process.env.FALLBACK_SPEED_MPS || (30 * 0.44704));

    for (const v of vans){
      if ((v.capacity||0) < pax) continue;
      if (typeof v.currentLat !== 'number' || typeof v.currentLng !== 'number') continue;
      const last = v.lastPing ? new Date(v.lastPing as any).getTime() : 0;
      if (!last || (Date.now() - last) > maxAgeMs) continue; // stale
      const tasks = tasksByVan.filter(t=> t.vanId===v.id);
      // If no tasks, simple ETA to pickup
      if (tasks.length===0){
        let sec: number | null = null;
        const legs = await osrmLegs([[v.currentLat!,v.currentLng!],[pLat,pLng]]);
        if (legs && legs[0]!=null){ sec = Number(legs[0]); }
        else {
          const d = haversineMeters(v.currentLat!, v.currentLng!, pLat, pLng); sec = d / fallbackSpeed;
        }
        if (sec!=null){ if (!best || sec < best.secondsToPickup) best = { vanId: v.id, name: v.name, secondsToPickup: sec }; }
        continue;
      }
      // Build base stops excluding start; filter invalid zeros
      const stopsOnly: Array<[number,number]> = [];
      tasks.forEach(t=> { 
        if (Number.isFinite(t.pickupLat) && Number.isFinite(t.pickupLng)) stopsOnly.push([Number(t.pickupLat), Number(t.pickupLng)]);
        if (Number.isFinite(t.dropLat) && Number.isFinite(t.dropLng)) stopsOnly.push([Number(t.dropLat), Number(t.dropLng)]);
      });
      let bestSec = Number.POSITIVE_INFINITY;
      for (let i=0;i<=stopsOnly.length;i++){
        const seq: Array<[number,number]> = [
          [v.currentLat!, v.currentLng!] as [number,number],
          ...stopsOnly.slice(0,i),
          [pLat,pLng] as [number,number],
          ...stopsOnly.slice(i),
        ];
        let sec: number | null = null;
        const legs = await osrmLegs(seq);
        if (legs && legs.length>0){
          sec = legs.slice(0, Math.min(i+1, legs.length)).reduce((a,b)=> a + (Number(b)||0), 0);
        } else {
          // Fallback: sum straight-line distances segments to pickup
          let meters = 0; for (let k=1;k<=i+1 && k<seq.length; k++){ meters += haversineMeters(seq[k-1][0], seq[k-1][1], seq[k][0], seq[k][1]); }
          sec = meters / fallbackSpeed;
        }
        if (sec < bestSec) bestSec = sec;
      }
      if (bestSec < Number.POSITIVE_INFINITY){ if (!best || bestSec < best.secondsToPickup) best = { vanId: v.id, name: v.name, secondsToPickup: bestSec }; }
    }

    if (!best) return NextResponse.json({ best: null });
    return NextResponse.json({ best });
  }catch(e:any){
    return NextResponse.json({ error:'failed' }, { status: 500 });
  }
}
