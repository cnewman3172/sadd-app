import { NextResponse } from 'next/server';
import { z } from 'zod';
import { allow } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const schema = z.object({ from: z.string().regex(/^[-\d\.]+,[-\d\.]+$/), to: z.string().regex(/^[-\d\.]+,[-\d\.]+$/) });

export async function GET(req: Request){
  const url = new URL(req.url);
  const parsed = schema.safeParse({ from: url.searchParams.get('from') || '', to: url.searchParams.get('to') || '' });
  if (!parsed.success) return NextResponse.json({ error:'from/to required' }, { status:400 });
  const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  if (!allow(`eta:${ip}`, Number(process.env.ETA_RATE_PER_MIN||'120'))) return NextResponse.json({ error:'rate limited' }, { status: 429 });
  const [fLat, fLng] = parsed.data.from.split(',').map(Number);
  const [tLat, tLng] = parsed.data.to.split(',').map(Number);
  const base = process.env.OSRM_URL || 'https://router.project-osrm.org';
  const r = await fetch(`${base}/route/v1/driving/${fLng},${fLat};${tLng},${tLat}?overview=false&alternatives=false&annotations=duration,distance`);
  if (!r.ok) return NextResponse.json({ error:'osrm failed' }, { status:502 });
  const data = await r.json();
  const route = data.routes?.[0];
  return NextResponse.json({ seconds: route?.duration ?? null, meters: route?.distance ?? null });
}
