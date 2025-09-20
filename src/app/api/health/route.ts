import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(){
  const start = Date.now();
  let dbOk = false;
  let userCount: number | null = null;
  try{
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
    userCount = await prisma.user.count();
  }catch(e:any){
    dbOk = false;
  }
  const setting = await prisma.setting.findUnique({ where: { id: 1 } }).catch(()=>null);
  const elapsed = Date.now() - start;
  return NextResponse.json({
    ok: true,
    uptime: process.uptime(),
    db: { ok: dbOk, userCount, ms: elapsed },
    active: setting?.active ?? false,
    env: {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
      osrmUrl: process.env.OSRM_URL || 'default',
    }
  });
}
