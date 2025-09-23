import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { publish } from '@/lib/events';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','DISPATCHER','TC'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  await prisma.van.updateMany({ where:{ activeTcId: payload.uid }, data:{ activeTcId: null, status: 'OFFLINE', passengers: 0 } });
  publish('vans:update', { by: payload.uid });
  logAudit('driver_offline', payload.uid);
  return NextResponse.json({ ok:true });
}
