import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: NextRequest){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  let s = await prisma.setting.findUnique({ where:{ id:1 } });
  if (!s){ s = await prisma.setting.create({ data: { id:1, active:false } }); }
  return NextResponse.json({ active: s.active, autoDisableEnabled: s.autoDisableEnabled, autoDisableTime: s.autoDisableTime, autoDisableTz: s.autoDisableTz });
}

export async function PUT(req: NextRequest){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const body = await req.json().catch(()=>({}));
  const autoDisableEnabled = Boolean(body?.autoDisableEnabled);
  const autoDisableTime = typeof body?.autoDisableTime === 'string' && /^\d{2}:\d{2}$/.test(body.autoDisableTime) ? body.autoDisableTime : undefined;
  const autoDisableTz = typeof body?.autoDisableTz === 'string' && body.autoDisableTz ? body.autoDisableTz : undefined;
  let s = await prisma.setting.findUnique({ where:{ id:1 } });
  if (!s){ s = await prisma.setting.create({ data: { id:1, active:false } }); }
  const updated = await prisma.setting.update({ where:{ id:1 }, data: { autoDisableEnabled, autoDisableTime: autoDisableTime ?? s.autoDisableTime, autoDisableTz: autoDisableTz ?? s.autoDisableTz } });
  return NextResponse.json({ ok:true, autoDisableEnabled: updated.autoDisableEnabled, autoDisableTime: updated.autoDisableTime, autoDisableTz: updated.autoDisableTz });
}

