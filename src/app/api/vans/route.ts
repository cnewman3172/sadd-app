import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(){
  const vans = await prisma.van.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(vans);
}

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = verifyToken(token);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'COORDINATOR')) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { name, capacity=8 } = await req.json();
  if (!name) return NextResponse.json({ error:'name required' }, { status: 400 });
  const van = await prisma.van.create({ data: { name, capacity: Number(capacity)||8 } });
  return NextResponse.json(van);
}
