import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const take = Number(url.searchParams.get('take')||'200');
  const items = await prisma.audit.findMany({ orderBy:{ createdAt:'desc' }, take });
  return NextResponse.json(items);
}
