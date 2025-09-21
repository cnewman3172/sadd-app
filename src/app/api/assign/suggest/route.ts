import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';

export const runtime = 'nodejs';

function haversineMeters(lat1:number, lon1:number, lat2:number, lon2:number){
  const R = 6371000;
  const toRad = (d:number)=> d*Math.PI/180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
}

const schema = z.object({ rideId: z.string().uuid() });

async function osrmDuration(coords: Array<[number,number]>)
{
  const base = process.env.OSRM_URL || 'https://router.project-osrm.org';
  const pairs = coords.map(([lat,lng])=> `${lng},${lat}`).join(';');
  const r = await fetch(`${base}/route/v1/driving/${pairs}?overview=false&alternatives=false`);
  if (!r.ok) return null;
  const d = await r.json();
  return d?.routes?.[0]?.duration ?? null;
}

export async function GET(req: Request){
  const url = new URL(req.url);
  const parsed = schema.safeParse({ rideId: url.searchParams.get('rideId') || '' });
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','COORDINATOR','TC'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  if (!parsed.success) return NextResponse.json({ error:'rideId required' }, { status:400 });
  const { rideId } = parsed.data;

  const ride = await prisma.ride.findUnique({ where:{ id: rideId } });
  if (!ride) return NextResponse.json({ error:'not found' }, { status:404 });
  const vans = await prisma.van.findMany({ where:{ status: { in: ['ACTIVE','MAINTENANCE'] } } });
  const tasksByVan = await prisma.ride.findMany({ where:{ status: { in:['ASSIGNED','EN_ROUTE','PICKED_UP'] } }, select:{ id:true, vanId:true, pickupLat:true, pickupLng:true, dropLat:true, dropLng:true } });
  const results: Array<{ vanId:string; name:string; seconds:number; meters:number }> = [];

  const candidates = vans.filter(v=> typeof v.currentLat==='number' && typeof v.currentLng==='number' && (v.capacity||0) >= (ride.passengers||1));

  await Promise.all(candidates.map(async v=>{
    const tasks = tasksByVan.filter(t=> t.vanId===v.id);
    // Build base stops: start at van location
    const baseStops: Array<[number,number]> = [[v.currentLat!, v.currentLng!]];
    tasks.forEach(t=> { baseStops.push([t.pickupLat, t.pickupLng], [t.dropLat, t.dropLng]); });
    // If no tasks, simple ETA to pickup + pickup->drop
    if (tasks.length===0){
      const dur = await osrmDuration([[v.currentLat!,v.currentLng!],[ride.pickupLat,ride.pickupLng],[ride.dropLat,ride.dropLng]]);
      if (dur!=null){ results.push({ vanId: v.id, name: v.name, seconds: dur, meters: 0 }); return; }
      const meters = haversineMeters(v.currentLat!, v.currentLng!, ride.pickupLat, ride.pickupLng);
      const seconds = meters / (35000/3600);
      results.push({ vanId: v.id, name: v.name, seconds, meters });
      return;
    }
    // Try inserting pickup/drop in the existing sequence to minimize total duration
    const stopsOnly = baseStops.slice(1); // exclude start
    const N = stopsOnly.length;
    let best = Number.POSITIVE_INFINITY;
    for (let i=0;i<=N;i++){
      for (let j=i+1;j<=N+1;j++){
        const seq = baseStops.slice(0,1).concat(stopsOnly.slice(0,i), [[ride.pickupLat,ride.pickupLng] as [number,number]], stopsOnly.slice(i,j-1), [[ride.dropLat,ride.dropLng] as [number,number]], stopsOnly.slice(j-1));
        const d = await osrmDuration(seq);
        if (d!=null && d < best){ best = d; }
      }
    }
    if (best<Number.POSITIVE_INFINITY){ results.push({ vanId: v.id, name: v.name, seconds: best, meters: 0 }); }
  }));

  results.sort((a,b)=> a.seconds - b.seconds);
  return NextResponse.json({ rideId, ranked: results });
}
