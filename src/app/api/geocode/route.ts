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
  // Ask Nominatim for address + name details and bound to Alaska viewbox
  const urlSearch = `${endpoint}/search?format=jsonv2&addressdetails=1&namedetails=1&q=${encodeURIComponent(q)}&limit=${limit}&countrycodes=${encodeURIComponent(countrycodes)}&viewbox=${encodeURIComponent(viewbox)}&bounded=1`;
  const r = await fetch(urlSearch, {
    headers: { 'User-Agent': 'SADD/1.0 (self-hosted)', 'Accept-Language': 'en-US' }
  });
  const data = await r.json();
  // Only return Alaska results with simplified labels
  function toLabel(d:any){
    const addr = d.address || {};
    const stateCode = addr.state_code || (addr["ISO3166-2-lvl4"] === 'US-AK' ? 'AK' : undefined) || (addr.state === 'Alaska' ? 'AK' : undefined) || addr.state;
    const name = (d.namedetails && (d.namedetails.name || d.namedetails["name:en"])) || d.name || addr.amenity || addr.shop || addr.tourism || addr.leisure || addr.office || addr.building || '';
    const streetName = addr.road || addr.residential || addr.pedestrian || addr.footway || addr.highway || addr.street || '';
    const house = addr.house_number ? `${addr.house_number} ` : '';
    const street = (house + streetName).trim();
    const city = addr.city || addr.town || addr.village || addr.hamlet || addr.locality || addr.county || '';
    const state = stateCode || '';
    const parts = [street, city, state].filter(Boolean);
    const base = parts.join(', ');
    if (name && base) return `${name}, ${base}`;
    return base || d.display_name;
  }
  const alaskaOnly = (data as any[]).filter((d:any)=>{
    const addr = d.address || {};
    const iso = addr["ISO3166-2-lvl4"] || addr["ISO3166-2-lvl3"] || '';
    const inAK = addr.state === 'Alaska' || addr.state_code === 'AK' || iso === 'US-AK';
    return inAK;
  });
  return NextResponse.json(alaskaOnly.map((d:any)=>({ label: toLabel(d), lat: Number(d.lat), lon: Number(d.lon) })));
}
