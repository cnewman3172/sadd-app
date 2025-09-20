import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({ q: z.string().min(2) });

export async function GET(req: Request){
  const url = new URL(req.url);
  const parsed = schema.safeParse({ q: url.searchParams.get('q') || '' });
  if (!parsed.success) return NextResponse.json([]);
  const { q } = parsed.data;
  const endpoint = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
  const r = await fetch(`${endpoint}/search?format=jsonv2&q=${encodeURIComponent(q)}`, {
    headers: { 'User-Agent': 'SADD/1.0 (self-hosted)' }
  });
  const data = await r.json();
  return NextResponse.json(data.map((d:any)=>({ label: d.display_name, lat: d.lat, lon: d.lon })));
}
