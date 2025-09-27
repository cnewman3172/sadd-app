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
  function isActive(){
    const base = Boolean(setting?.active);
    if (!base) return false;
    if (!setting?.autoDisableEnabled) return base;
    const tz = setting?.autoDisableTz || 'America/Anchorage';
    const hhmm = String(setting?.autoDisableTime || '22:00');
    const [sh, sm] = hhmm.split(':').map(x=> parseInt(x,10) || 0);
    const cut = sh*60 + sm;
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(new Date());
    const h = parseInt(parts.find(p=>p.type==='hour')?.value||'0',10);
    const mi = parseInt(parts.find(p=>p.type==='minute')?.value||'0',10);
    const nowMin = h*60 + mi;
    return nowMin < cut;
  }
  const elapsed = Date.now() - start;
  return NextResponse.json({
    ok: true,
    uptime: process.uptime(),
    db: { ok: dbOk, userCount, ms: elapsed },
    active: isActive(),
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
