import { NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { captureError } from '@/lib/obs';
import { publish } from '@/lib/events';
import { notifyOnShift } from '@/lib/push';
import { logAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  pickupAddr: z.string().min(1).optional(),
  dropAddr: z.string().min(1).optional(),
  passengers: z.number().int().min(1).max(11).optional(),
  notes: z.string().max(500).optional(),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  dropLat: z.number().optional(),
  dropLng: z.number().optional(),
});

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload) return NextResponse.json({ error:'auth required' }, { status: 401 });
  try{
    // Block new requests when SADD is inactive (consider auto-disable schedule)
    const setting = await prisma.setting.findUnique({ where:{ id:1 } }).catch(()=>null);
    const isActive = (()=>{
      const base = Boolean(setting?.active);
      if (!base) return false;
      if (!setting?.autoDisableEnabled) return base;
      const tz = setting?.autoDisableTz || 'America/Anchorage';
      const hhmm = String(setting?.autoDisableTime || '22:00');
      const [sh, sm] = hhmm.split(':').map(x=> parseInt(x,10) || 0);
      const cut = sh*60 + sm;
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(new Date());
      const h = parseInt(parts.find(p=>p.type==='hour')?.value||'0',10);
      const mi = parseInt(parts.find(p=>p.type==='minute')?.value||'0',10);
      const nowMin = h*60 + mi;
      return nowMin < cut; // disable at and after cutoff every day
    })();
    if (!isActive){
      return NextResponse.json({ error:'SADD is currently inactive. Please try again later.' }, { status: 403 });
    }
    const { pickupAddr, dropAddr, passengers=1, notes, pickupLat, pickupLng, dropLat, dropLng } = schema.parse(await req.json());
    // naive: if coords missing, leave zeros and let dispatcher edit later
    const ride = await prisma.ride.create({ data: {
      riderId: payload.uid,
      pickupAddr: pickupAddr || 'Unknown',
      dropAddr: dropAddr || 'Unknown',
      pickupLat: pickupLat ?? 0,
      pickupLng: pickupLng ?? 0,
      dropLat: dropLat ?? 0,
      dropLng: dropLng ?? 0,
      passengers: Number(passengers) || 1,
      notes,
    }});
    publish('ride:update', { id: ride.id, status: ride.status, code: ride.rideCode, riderId: ride.riderId });
    // Background push for on-shift roles; SW will suppress if app is open
    try{
      const msg = `New request #${ride.rideCode}`;
      await Promise.all([
        notifyOnShift('DISPATCHER', { title: msg, body: `${ride.pickupAddr} → ${ride.dropAddr}`, tag: 'ride-request', data:{ rideId: ride.id } }),
        notifyOnShift('TC', { title: msg, body: `${ride.pickupAddr} → ${ride.dropAddr}`, tag: 'ride-request', data:{ rideId: ride.id } }),
      ]);
    }catch{}
    // Auto-assign best van
    try{
      const origin = new URL(req.url).origin;
      const s = await fetch(`${origin}/api/assign/suggest?rideId=${ride.id}`).then(r=>r.json());
      const best = s.ranked?.[0];
      if (best?.vanId){
        const updated = await prisma.ride.update({ where: { id: ride.id }, data: { status:'ASSIGNED', vanId: best.vanId, acceptedAt: new Date() } });
        publish('ride:update', { id: updated.id, status: updated.status, code: updated.rideCode, vanId: updated.vanId, riderId: updated.riderId });
        try{ const { rebuildPlanForVan } = await import('@/lib/plan'); await rebuildPlanForVan(best.vanId); }catch{}
        logAudit('ride_auto_assign', payload.uid, updated.id, { vanId: best.vanId });
      }
    }catch{}
    logAudit('ride_create', payload.uid, ride.id, { pickupAddr, dropAddr, passengers });
    return NextResponse.json(ride);
  }catch(e:any){
    captureError(e, { route: 'rides/request', uid: payload.uid });
    return NextResponse.json({ error: e?.message || 'Request failed' }, { status: 400 });
  }
}
