import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';

export const runtime = 'nodejs';

const Cat = z.enum(['SAFETY','DRIVER','TC','DISPATCHER']);

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload) return NextResponse.json({ error:'unauthorized' }, { status: 401 });
  try{
    const { category } = Cat.transform(v=>({ category: v })).parse(await req.json());
    const now = new Date();
    const data: any = {};
    if (category==='SAFETY') data.trainingSafetyAt = now;
    if (category==='DRIVER') data.trainingDriverAt = now;
    if (category==='TC') data.trainingTcAt = now;
    if (category==='DISPATCHER') data.trainingDispatcherAt = now;
    const u = await prisma.user.update({ where: { id: payload.uid }, data, select: { id:true, role:true, trainingSafetyAt:true, trainingDriverAt:true, trainingTcAt:true, trainingDispatcherAt:true, checkRide:true } });
    return NextResponse.json({ ok:true, user: u });
  }catch(e:any){
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 400 });
  }
}

