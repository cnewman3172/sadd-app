import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: Request){
  // Restrict to ADMIN only
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
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
  const isActive = Boolean(setting?.active);
  const elapsed = Date.now() - start;
  return NextResponse.json({
    ok: true,
    uptime: process.uptime(),
    db: { ok: dbOk, userCount, ms: elapsed },
    active: isActive,
    buildSha: process.env.BUILD_SHA || 'dev',
    env: {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
      osrmUrl: process.env.OSRM_URL || 'default',
      hasSmtpHost: Boolean(process.env.SMTP_HOST),
      hasSmtpPort: Boolean(process.env.SMTP_PORT),
      hasSmtpUser: Boolean(process.env.SMTP_USER),
      hasSmtpFrom: Boolean(process.env.SMTP_FROM),
    }
  });
}
