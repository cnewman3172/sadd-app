import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { captureError } from '@/lib/obs';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  try{
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const where = q ? {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } }
      ]
    } : {};
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, rank: true, role: true, createdAt: true }
    });
    return NextResponse.json(users);
  }catch(e:any){
    captureError(e, { route: 'admin/users#GET', uid: payload.uid });
    return NextResponse.json({ error:'failed' }, { status: 500 });
  }
}
