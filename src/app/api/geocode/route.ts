import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  if (!q) return NextResponse.json([]);
  const endpoint = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
  const r = await fetch(`${endpoint}/search?format=jsonv2&q=${encodeURIComponent(q)}`, {
    headers: { 'User-Agent': 'SADD/1.0 (self-hosted)' }
  });
  const data = await r.json();
  return NextResponse.json(data.map((d:any)=>({ label: d.display_name, lat: d.lat, lon: d.lon })));
}

