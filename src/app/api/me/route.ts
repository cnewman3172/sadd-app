import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({}, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  return NextResponse.json({ ...user, password: undefined });
}

export async function PUT(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({}, { status: 401 });
  const body = await req.json();
  const { firstName, lastName, rank, unit, phone } = body;
  const user = await prisma.user.update({ where: { id: payload.uid }, data: { firstName, lastName, rank, unit, phone } });
  return NextResponse.json({ ...user, password: undefined });
}
