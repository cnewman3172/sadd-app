import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const s = await prisma.setting.upsert({ where:{ id:1 }, update:{ active: { set: undefined } }, create:{ id:1, active:false } });
  const toggled = await prisma.setting.update({ where:{ id:1 }, data:{ active: !s.active } });
  return NextResponse.json(toggled);
}
