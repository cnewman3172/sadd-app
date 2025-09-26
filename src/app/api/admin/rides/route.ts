import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { captureError } from '@/lib/obs';
import { publish } from '@/lib/events';
import { logAudit } from '@/lib/audit';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

const schema = z.object({
  riderId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  phone: z.string().min(7).optional(),
  pickupAddr: z.string().min(1),
  dropAddr: z.string().min(1),
  passengers: z.coerce.number().int().min(1).max(11).default(1),
  notes: z.string().max(500).optional(),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  dropLat: z.number().optional(),
  dropLng: z.number().optional(),
});

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','DISPATCHER'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  try{
    const body = schema.parse(await req.json());
    // Ensure coordinates by geocoding when only address provided
    async function geocode(addr?: string){
      if (!addr) return null as null | { lat:number; lon:number };
      try{
        const endpoint = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
        const r = await fetch(`${endpoint}/search?format=jsonv2&q=${encodeURIComponent(addr)}`, { headers: { 'User-Agent':'SADD/1.0 (admin-create)' } });
        if (!r.ok) return null;
        const d = await r.json();
        const first = Array.isArray(d) && d[0];
        if (first && first.lat && first.lon) return { lat: Number(first.lat), lon: Number(first.lon) };
      }catch{}
      return null;
    }
    if ((body.pickupLat==null || body.pickupLng==null) && body.pickupAddr){
      const g = await geocode(body.pickupAddr);
      if (g){ (body as any).pickupLat = g.lat; (body as any).pickupLng = g.lon; }
    }
    if ((body.dropLat==null || body.dropLng==null) && body.dropAddr){
      const g = await geocode(body.dropAddr);
      if (g){ (body as any).dropLat = g.lat; (body as any).dropLng = g.lon; }
    }
    let riderId = body.riderId as string | undefined;
    if (!riderId){
      // Attach to a shared unlinked rider account (not per-person)
      const email = 'unlinked@sadd.local';
      let u = await prisma.user.findUnique({ where: { email } });
      if (!u){
        const hash = await bcrypt.hash(Math.random().toString(36).slice(2), 10);
        u = await prisma.user.create({ data: { email, password: hash, firstName: 'Unlinked', lastName: 'Rider', role: 'RIDER' } });
      }
      riderId = u.id;
    }
    // Ensure rider phone matches manual entry (if provided)
    else if (body.phone){
      try{
        const existing = await prisma.user.findUnique({ where:{ id: riderId } });
        if (existing && existing.phone !== body.phone){
          await prisma.user.update({ where:{ id: riderId }, data:{ phone: body.phone } });
        }
      }catch{}
    }

    // Attach manual contact info into notes as JSON if provided
    let notes: string | undefined = body.notes;
    if (body.name || body.phone){
      try{
        const meta: any = { manualContact: { name: body.name, phone: body.phone } };
        if (notes) meta.memo = notes;
        notes = JSON.stringify(meta);
      }catch{}
    }
    const ride = await prisma.ride.create({ data: {
      riderId: riderId!,
      pickupAddr: body.pickupAddr,
      dropAddr: body.dropAddr,
      pickupLat: body.pickupLat ?? 0,
      pickupLng: body.pickupLng ?? 0,
      dropLat: body.dropLat ?? 0,
      dropLng: body.dropLng ?? 0,
      passengers: Number(body.passengers) || 1,
      notes,
      source: 'REQUEST',
    }});
    publish('ride:update', { id: ride.id, status: ride.status, code: ride.rideCode, riderId: ride.riderId });
    // Auto-assign best van
    try{
      const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
      const s = await fetch(`${origin}/api/assign/suggest?rideId=${ride.id}`).then(r=>r.json());
      const best = s.ranked?.[0];
      if (best?.vanId){
        const updated = await prisma.ride.update({ where: { id: ride.id }, data: { status:'ASSIGNED', vanId: best.vanId, acceptedAt: new Date() } });
        publish('ride:update', { id: updated.id, status: updated.status, code: updated.rideCode, vanId: updated.vanId, riderId: updated.riderId });
        await logAudit('ride_auto_assign', payload.uid, updated.id, { vanId: best.vanId });
      }
    }catch{}
    await logAudit('ride_create_manual', payload.uid, ride.id, { riderId });
    return NextResponse.json(ride);
  }catch(e:any){
    captureError(e, { route: 'admin/rides#create', uid: payload?.uid });
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 400 });
  }
}
