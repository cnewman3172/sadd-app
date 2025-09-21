import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { createConfirmToken, verifyConfirmToken } from '@/lib/confirm';

export const runtime = 'nodejs';

const ACTION = 'reset_rides_v1';

export async function GET(req: NextRequest){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const confirmToken = createConfirmToken(ACTION, payload.uid);
  return NextResponse.json({
    token: confirmToken,
    phrase: 'RESET ALL RIDES',
    expiresInSeconds: 300,
    note: 'This will permanently delete all rides and clear van live state (location, passengers). Users and vans remain.'
  });
}

export async function POST(req: NextRequest){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { token: confirmToken, phrase } = await req.json().catch(()=>({} as any));
  if (phrase !== 'RESET ALL RIDES') return NextResponse.json({ error:'wrong phrase' }, { status: 400 });
  const verified = confirmToken && verifyConfirmToken(confirmToken, ACTION);
  if (!verified || verified.u !== payload.uid) return NextResponse.json({ error:'invalid token' }, { status: 400 });

  await prisma.$transaction(async(tx)=>{
    await tx.ride.deleteMany({});
    await tx.van.updateMany({ data: { passengers: 0, currentLat: null, currentLng: null, lastPing: null, status: 'ACTIVE' } });
  });
  await logAudit('admin_reset_rides', payload.uid);
  return NextResponse.json({ ok: true });
}

