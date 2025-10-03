import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { captureError } from '@/lib/obs';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','DISPATCHER'].includes(payload.role)) {
    return NextResponse.json({ error:'forbidden' }, { status: 403 });
  }
  try{
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const qDigits = q.replace(/\D+/g,'');
    const hasAlpha = /[a-zA-Z]/.test(q);
    const includeDisabled = url.searchParams.get('includeDisabled') === '1';
    const base = includeDisabled ? {} : { disabled: false } as any;
    const where = q ? {
      AND: [ base, {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          ...(qDigits.length >= 3 ? [{ phone: { contains: hasAlpha ? q : qDigits, mode: 'insensitive' } }] : []),
        ]
      } ]
    } : base;
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, rank: true, role: true, createdAt: true }
    });
    const filtered = (!hasAlpha && qDigits.length >= 3)
      ? users.filter(u => (u.phone || '').replace(/\D+/g,'').includes(qDigits))
      : users;
    return NextResponse.json(filtered);
  }catch(e:any){
    captureError(e, { route: 'admin/users#GET', uid: payload.uid });
    return NextResponse.json({ error:'failed' }, { status: 500 });
  }
}
