import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const pr = await prisma.passwordReset.findUnique({ where: { token } });
  const ok = !!pr && !pr.usedAt && pr.expiresAt > new Date();
  return NextResponse.json({ ok });
}

export async function POST(req: NextRequest){
  const { token, password } = await req.json();
  if (!token || typeof password !== 'string' || password.length < 8) return NextResponse.json({ error:'invalid' }, { status: 400 });
  const pr = await prisma.passwordReset.findUnique({ where: { token } });
  if (!pr || pr.usedAt || pr.expiresAt <= new Date()) return NextResponse.json({ error:'expired' }, { status: 400 });
  const hash = await bcrypt.hash(password, 10);
  await prisma.$transaction(async(tx)=>{
    await tx.user.update({ where: { id: pr.userId }, data: { password: hash } });
    await tx.passwordReset.update({ where: { token }, data: { usedAt: new Date() } });
  });
  return NextResponse.json({ ok:true });
}

