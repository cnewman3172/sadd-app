import { NextResponse } from 'next/server';
import { verifyToken } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';

export async function GET(req: Request){
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit')||'3');
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json([], { status: 401 });
  const rides = await prisma.ride.findMany({ where: { riderId: payload.uid }, orderBy: { requestedAt: 'desc' }, take: limit });
  return NextResponse.json(rides);
}

