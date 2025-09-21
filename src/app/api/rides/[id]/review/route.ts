import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { captureError } from '@/lib/obs';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  bypass: z.boolean().optional(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload) return NextResponse.json({ error:'auth required' }, { status: 401 });
  const { id } = await context.params;
  try{
    const body = schema.parse(await req.json());
    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride) return NextResponse.json({ error:'not found' }, { status: 404 });
    if (ride.riderId !== payload.uid) return NextResponse.json({ error:'forbidden' }, { status: 403 });
    const updated = await prisma.ride.update({ where: { id }, data: {
      rating: body.rating,
      reviewComment: body.comment,
      reviewBypass: Boolean(body.bypass),
      reviewAt: new Date(),
    }});
    logAudit('ride_review', payload.uid, id, { rating: body.rating, bypass: Boolean(body.bypass) });
    return NextResponse.json(updated);
  }catch(e:any){
    captureError(e, { route: 'rides/[id]/review#POST', id });
    return NextResponse.json({ error:'failed' }, { status: 400 });
  }
}

