import { NextResponse } from 'next/server';
import { z } from 'zod';
import { allow } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const schema = z.object({ q: z.string().min(2) });

export async function GET(req: Request){
  const url = new URL(req.url);
  const parsed = schema.safeParse({ q: url.searchParams.get('q') || '' });
  if (!parsed.success) return NextResponse.json([]);
  const { q } = parsed.data;
  const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  if (!allow(`geocode:${ip}`, Number(process.env.GEOCODE_RATE_PER_MIN||'60'))) return NextResponse.json([], { status: 429 });
  const endpoint = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
  const limit = Number(process.env.GEOCODE_LIMIT||'10')||10;
  const countrycodes = (process.env.GEO_COUNTRYCODES || 'us').trim();
  const viewbox = (process.env.GEO_BIAS_VIEWBOX || '-179.231086,71.5388,-129.9795,51.2097').trim(); // Alaska bias (left,top,right,bottom)
  const urlSearch = `${endpoint}/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=${limit}&countrycodes=${encodeURIComponent(countrycodes)}&viewbox=${encodeURIComponent(viewbox)}`;
  const r = await fetch(urlSearch, {
    headers: { 'User-Agent': 'SADD/1.0 (self-hosted)', 'Accept-Language': 'en-US' }
  });
  const data = await r.json();
  return NextResponse.json(data.map((d:any)=>({ label: d.display_name, lat: d.lat, lon: d.lon })));
}
