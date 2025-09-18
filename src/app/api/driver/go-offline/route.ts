import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = verifyToken(token);
  if (!payload || !['ADMIN','COORDINATOR','TC'].includes(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  await prisma.van.updateMany({ where:{ activeTcId: payload.uid }, data:{ activeTcId: null, status: 'OFFLINE', passengers: 0 } });
  return NextResponse.json({ ok:true });
}

