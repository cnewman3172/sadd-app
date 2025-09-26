import { prisma } from '@/lib/prisma';

type Coord = [number, number]; // [lat,lng]

function haversineMeters(a: Coord, b: Coord){
  const [lat1, lon1] = a; const [lat2, lon2] = b;
  const R = 6371000;
  const toRad = (d:number)=> d*Math.PI/180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const aa = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2*Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
  return R*c;
}

async function osrmDuration(coords: Coord[]): Promise<{ total:number; legSeconds:number[] } | null>{
  if (coords.length < 2) return { total: 0, legSeconds: [] };
  const base = process.env.OSRM_URL || 'https://router.project-osrm.org';
  const pairs = coords.map(([lat,lng])=> `${lng},${lat}`).join(';');
  const url = `${base}/route/v1/driving/${pairs}?overview=false&steps=false&annotations=duration`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const d = await r.json();
  const route = d?.routes?.[0];
  const legs: number[] = Array.isArray(route?.legs) ? route.legs.map((l:any)=> Number(l?.duration||0)) : [];
  const total = Number(route?.duration || legs.reduce((s,x)=>s+x,0));
  return { total, legSeconds: legs };
}

function capacityOK(sequence: Array<{ rideId:string; phase:'PICKUP'|'DROP'; pax:number }>, capacity:number){
  let occ = 0; let ok = true;
  const seen = new Map<string, number>();
  for (const s of sequence){
    if (s.phase==='PICKUP'){ occ += s.pax; seen.set(s.rideId, (seen.get(s.rideId)||0) + s.pax); }
    else { occ -= (seen.get(s.rideId)||1); }
    if (occ > capacity){ ok = false; break; }
  }
  return ok;
}

export async function rebuildPlanForVan(vanId: string){
  const van = await prisma.van.findUnique({ where:{ id: vanId } });
  if (!van) return;
  const rides = await prisma.ride.findMany({ where:{ vanId, status:{ in:['ASSIGNED','EN_ROUTE','PICKED_UP'] } }, orderBy:{ requestedAt:'asc' } });
  // Clear previous plan
  await prisma.vanTask.deleteMany({ where:{ vanId } });
  if (rides.length===0) return;
  const start: Coord = typeof van.currentLat==='number' && typeof van.currentLng==='number'
    ? [van.currentLat, van.currentLng]
    : [rides[0].pickupLat, rides[0].pickupLng];
  const cap = van.capacity || 8;
  type Stop = { rideId:string; phase:'PICKUP'|'DROP'; coord:Coord; pax:number };
  let plan: Stop[] = [];

  for (const r of rides){
    const pickup: Stop = { rideId: r.id, phase:'PICKUP', coord:[r.pickupLat,r.pickupLng], pax: r.passengers||1 };
    const drop: Stop = { rideId: r.id, phase:'DROP', coord:[r.dropLat,r.dropLng], pax: r.passengers||1 };
    if (plan.length===0){ plan.push(pickup, drop); continue; }
    // Try all insertion points i<j to minimize pickup ETA first, then total duration
    let bestIdx: [number,number] | null = null;
    let bestPickupEta = Infinity; let bestTotal = Infinity;
    const baseCoords = [start, ...plan.map(s=>s.coord)];
    const N = plan.length;
    for (let i=0;i<=N;i++){
      for (let j=i+1;j<=N+1;j++){
        const seq = plan.slice(0,i).concat([pickup], plan.slice(i,j-1), [drop], plan.slice(j-1));
        // Capacity check along sequence
        if (!capacityOK(seq.map(s=>({ rideId:s.rideId, phase:s.phase, pax:s.pax })), cap)) continue;
        const coords: Coord[] = [start, ...seq.map(s=>s.coord)];
        // De-duplicate near-equal consecutive coords to stabilize OSRM
        const filtered: Coord[] = [coords[0]];
        for (let k=1;k<coords.length;k++){
          const prev = filtered[filtered.length-1];
          if (haversineMeters(prev, coords[k]) < 30) continue; // collapse very close points
          filtered.push(coords[k]);
        }
        const res = await osrmDuration(filtered);
        if (!res) continue;
        // Map pickup position in filtered vs seq — approximate by cum distance index
        // Simpler: approximate pickup ETA by OSRM from start to pickup using a sub-call
        const res2 = await osrmDuration([start, pickup.coord]);
        const pickupEta = res2?.total ?? Infinity;
        const total = res.total;
        if (pickupEta < bestPickupEta || (Math.abs(pickupEta-bestPickupEta)<1 && total < bestTotal)){
          bestPickupEta = pickupEta; bestTotal = total; bestIdx = [i,j];
        }
      }
    }
    if (bestIdx){
      const [i,j] = bestIdx;
      plan = plan.slice(0,i).concat([pickup], plan.slice(i,j-1), [drop], plan.slice(j-1));
    } else {
      // fallback append
      plan.push(pickup, drop);
    }
  }

  // Persist plan
  await prisma.$transaction(async(tx)=>{
    let order = 1;
    for (const s of plan){
      await tx.vanTask.create({ data: { vanId, rideId: s.rideId, phase: s.phase as any, order } });
      order += 1;
    }
  });
}

export async function getPlanTasks(vanId: string){
  const entries = await prisma.vanTask.findMany({ where:{ vanId }, orderBy:{ order:'asc' } });
  return entries;
}

