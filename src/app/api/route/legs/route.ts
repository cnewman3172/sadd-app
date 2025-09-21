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
    const url = `${base}/route/v1/driving/${pairs}?overview=false&geometries=geojson&steps=false&annotations=duration`;
    const r = await fetch(url);
    if (!r.ok) return NextResponse.json({ error:'osrm failed' }, { status: 502 });
    const data = await r.json();
    const route = data.routes?.[0];
    const legsSeconds: number[] = Array.isArray(route?.legs) ? route.legs.map((l:any)=> Number(l?.duration||0)) : [];
    return NextResponse.json({ legsSeconds });
  }catch(e:any){
    return NextResponse.json({ error:'failed' }, { status: 400 });
  }
}

