import { NextResponse } from 'next/server';
import { z } from 'zod';
import { allow } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const schema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
});

function buildLabel(d: any, allowStates: string[], allowIsos: string[], allowStateNames: string[]){
  if (!d) return '';
  const addr = d.address || {};
  const iso = addr["ISO3166-2-lvl4"] || addr["ISO3166-2-lvl3"];
  const stateCode = addr.state_code
    || (iso && allowIsos.includes(iso) ? (allowStates[0] || '') : undefined)
    || (addr.state && allowStateNames.includes(addr.state) ? (allowStates[0] || '') : undefined)
    || addr.state;
  const name = (d.namedetails && (d.namedetails.name || d.namedetails["name:en"]))
    || d.name
    || addr.amenity
    || addr.shop
    || addr.tourism
    || addr.leisure
    || addr.office
    || addr.building
    || '';
  const streetName = addr.road
    || addr.residential
    || addr.pedestrian
    || addr.footway
    || addr.highway
    || addr.street
    || '';
  const house = addr.house_number ? `${addr.house_number} ` : '';
  const street = (house + streetName).trim();
  const city = addr.city || addr.town || addr.village || addr.hamlet || addr.locality || addr.county || '';
  const state = stateCode || '';
  const parts = [street, city, state].filter(Boolean);
  const base = parts.join(', ');
  if (name && base) return `${name}, ${base}`;
  return base || d.display_name || '';
}

function isAllowedRegion(addr: any, allowStates: string[], allowIsos: string[], allowStateNames: string[]){
  if (!addr) return false;
  const iso = addr["ISO3166-2-lvl4"] || addr["ISO3166-2-lvl3"] || '';
  return Boolean(
    (addr.state_code && allowStates.includes(addr.state_code))
    || (addr.state && allowStateNames.includes(addr.state))
    || (iso && allowIsos.includes(iso))
  );
}

export async function GET(req: Request){
  const url = new URL(req.url);
  const parsed = schema.safeParse({ lat: url.searchParams.get('lat'), lon: url.searchParams.get('lon') });
  if (!parsed.success) return NextResponse.json({ label: null }, { status: 400 });

  const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  const limit = Number(process.env.GEOCODE_RATE_PER_MIN || '60');
  if (!allow(`geocode:${ip}`, limit)) return NextResponse.json({ label: null }, { status: 429 });

  const { lat, lon } = parsed.data;
  const endpoint = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
  const allowStates = (process.env.GEO_ALLOW_STATES || 'AK').split(',').map(s => s.trim()).filter(Boolean);
  const allowIsos = (process.env.GEO_ALLOW_ISO || 'US-AK').split(',').map(s => s.trim()).filter(Boolean);
  const allowStateNames = (process.env.GEO_ALLOW_STATE_NAMES || 'Alaska').split(',').map(s => s.trim()).filter(Boolean);

  try {
    const reverseUrl = `${endpoint}/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&addressdetails=1&namedetails=1`;
    const resp = await fetch(reverseUrl, {
      headers: { 'User-Agent': 'SADD/1.0 (self-hosted)', 'Accept-Language': 'en-US' },
    });
    if (!resp.ok) return NextResponse.json({ label: null }, { status: resp.status });
    const data = await resp.json();
    if (!isAllowedRegion(data?.address, allowStates, allowIsos, allowStateNames)){
      return NextResponse.json({ label: null }, { status: 200 });
    }
    const label = buildLabel(data, allowStates, allowIsos, allowStateNames);
    return NextResponse.json({ label: label || null, lat, lon });
  } catch (err) {
    console.error('reverse geocode failed', err);
    return NextResponse.json({ label: null }, { status: 500 });
  }
}
