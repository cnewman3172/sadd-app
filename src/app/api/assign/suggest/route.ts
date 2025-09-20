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
  const candidates = vans.filter(v=> typeof v.currentLat==='number' && typeof v.currentLng==='number' && (v.capacity||0) >= (ride.passengers||1));
  const base = process.env.OSRM_URL || 'https://router.project-osrm.org';

  const results: Array<{ vanId:string; name:string; seconds:number; meters:number }> = [];

  // Batch query OSRM by sending multiple requests in parallel
  await Promise.all(candidates.map(async v=>{
    const from = `${v.currentLng},${v.currentLat}`;
    const to = `${ride.pickupLng},${ride.pickupLat}`;
    try{
      const r = await fetch(`${base}/route/v1/driving/${from};${to}?overview=false&alternatives=false`);
      if (r.ok){
        const data:any = await r.json();
        const route = data.routes?.[0];
        if (route){
          results.push({ vanId: v.id, name: v.name, seconds: route.duration, meters: route.distance });
          return;
        }
      }
    }catch{}
    // Fallback to haversine at ~35km/h average
    const meters = haversineMeters(v.currentLat!, v.currentLng!, ride.pickupLat, ride.pickupLng);
    const seconds = meters / (35000/3600);
    results.push({ vanId: v.id, name: v.name, seconds, meters });
  }));

  results.sort((a,b)=> a.seconds - b.seconds);
  return NextResponse.json({ rideId, ranked: results });
}
