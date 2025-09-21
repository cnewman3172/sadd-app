import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest){
  try{
    const body = await req.json();
    const coords: Array<[number, number]> = body?.coords || [];
    if (!Array.isArray(coords) || coords.length < 2) return NextResponse.json({ error:'coords required' }, { status: 400 });
    // OSRM expects lng,lat
    const pairs = coords.map(([lat,lng])=> `${lng},${lat}`).join(';');
    const base = process.env.OSRM_URL || 'https://router.project-osrm.org';
    const url = `${base}/route/v1/driving/${pairs}?overview=full&geometries=geojson&steps=false&annotations=false`;
    const r = await fetch(url);
    if (!r.ok) return NextResponse.json({ error:'osrm failed' }, { status: 502 });
    const data = await r.json();
    const route = data.routes?.[0];
    const g = route?.geometry;
    const coordsGeo: Array<[number, number]> = Array.isArray(g?.coordinates) ? g.coordinates : [];
    // Convert GeoJSON [lng,lat] -> [lat,lng]
    const line: Array<[number, number]> = coordsGeo.map(([lng,lat]:[number,number])=> [lat,lng]);
    return NextResponse.json({
      coordinates: line,
      meters: route?.distance ?? null,
      seconds: route?.duration ?? null,
    });
  }catch(e:any){
    return NextResponse.json({ error:'failed' }, { status: 400 });
  }
}

