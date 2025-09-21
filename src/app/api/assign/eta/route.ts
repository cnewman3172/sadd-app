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
  const r = await fetch(`${base}/route/v1/driving/${pairs}?overview=false&alternatives=false&annotations=duration`);
  if (!r.ok) return null as null | number[];
  const d = await r.json();
  const legs: number[] = d?.routes?.[0]?.legs?.map((l:any)=> l?.duration ?? 0) ?? [];
  return legs;
}

export async function GET(req: Request){
  const url = new URL(req.url);
  const parsed = schema.safeParse({ pickup: url.searchParams.get('pickup') || '', pax: url.searchParams.get('pax') || '1' });
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  if (!parsed.success) return NextResponse.json({ error:'pickup required' }, { status:400 });
  const [pLat, pLng] = parsed.data.pickup.split(',').map(Number);
  const pax = parsed.data.pax;

  const vans = await prisma.van.findMany({ where:{ status: { in: ['ACTIVE','MAINTENANCE'] } } });
  const tasksByVan = await prisma.ride.findMany({ where:{ status: { in:['ASSIGNED','EN_ROUTE','PICKED_UP'] } }, select:{ id:true, vanId:true, pickupLat:true, pickupLng:true, dropLat:true, dropLng:true } });

  let best: { vanId:string; name:string; secondsToPickup:number } | null = null;

  for (const v of vans){
    if (typeof v.currentLat !== 'number' || typeof v.currentLng !== 'number') continue;
    if ((v.capacity||0) < pax) continue;
    const tasks = tasksByVan.filter(t=> t.vanId===v.id);
    // If no tasks, simple ETA to pickup
    if (tasks.length===0){
      const legs = await osrmLegs([[v.currentLat!,v.currentLng!],[pLat,pLng]]);
      const sec = (legs && legs[0]) ? Number(legs[0]) : null;
      if (sec!=null){
        if (!best || sec < best.secondsToPickup) best = { vanId: v.id, name: v.name, secondsToPickup: sec };
      }
      continue;
    }
    // Build base stops excluding start
    const stopsOnly: Array<[number,number]> = [];
    tasks.forEach(t=> { 
      stopsOnly.push([Number(t.pickupLat ?? 0), Number(t.pickupLng ?? 0)]);
      stopsOnly.push([Number(t.dropLat ?? 0), Number(t.dropLng ?? 0)]);
    });
    let bestSec = Number.POSITIVE_INFINITY;
    for (let i=0;i<=stopsOnly.length;i++){
      const seq: Array<[number,number]> = [[v.currentLat!, v.currentLng!]]
        .concat(stopsOnly.slice(0,i))
        .concat([[pLat,pLng] as [number,number]])
        .concat(stopsOnly.slice(i));
      const legs = await osrmLegs(seq);
      if (!legs || legs.length===0) continue;
      // Sum from start to the leg that arrives at pickup (which is leg index i)
      const toPickup = legs.slice(0, Math.min(i+1, legs.length)).reduce((a,b)=> a + (Number(b)||0), 0);
      if (toPickup < bestSec) bestSec = toPickup;
    }
    if (bestSec < Number.POSITIVE_INFINITY){
      if (!best || bestSec < best.secondsToPickup) best = { vanId: v.id, name: v.name, secondsToPickup: bestSec };
    }
  }

  if (!best) return NextResponse.json({ best: null });
  return NextResponse.json({ best });
}
