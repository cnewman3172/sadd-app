import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to) return NextResponse.json({ error:'from/to required' }, { status:400 });
  // from/to as "lat,lng"
  const [fLat, fLng] = from.split(',').map(Number);
  const [tLat, tLng] = to.split(',').map(Number);
  if ([fLat,fLng,tLat,tLng].some(n=>Number.isNaN(n))) return NextResponse.json({ error:'bad coords' }, { status:400 });
  const base = process.env.OSRM_URL || 'https://router.project-osrm.org';
  const r = await fetch(`${base}/route/v1/driving/${fLng},${fLat};${tLng},${tLat}?overview=false&alternatives=false&annotations=duration,distance`);
  if (!r.ok) return NextResponse.json({ error:'osrm failed' }, { status:502 });
  const data = await r.json();
  const route = data.routes?.[0];
  return NextResponse.json({ seconds: route?.duration ?? null, meters: route?.distance ?? null });
}

