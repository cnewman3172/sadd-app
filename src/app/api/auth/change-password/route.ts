import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error:'unauthorized' }, { status: 401 });
  const { current, next } = await req.json();
  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  if (!user) return NextResponse.json({ error:'not found' }, { status:404 });
  const ok = await bcrypt.compare(current, user.password);
  if (!ok) return NextResponse.json({ error:'invalid' }, { status: 400 });
  const hash = await bcrypt.hash(next, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
  return NextResponse.json({ ok:true });
}
