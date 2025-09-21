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
  function isActive(){
    const base = Boolean(setting?.active);
    if (!base) return false;
    if (!setting?.autoDisableEnabled) return base;
    const tz = setting?.autoDisableTz || "America/Anchorage";
    const hhmm = String(setting?.autoDisableTime || "22:00");
    const sh = parseInt(hhmm.split(":")[0]||"0",10);
    const sm = parseInt(hhmm.split(":")[1]||"0",10);
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour:"2-digit", minute:"2-digit", hour12:false }).formatToParts(new Date());
    const curH = parseInt((parts.find(p=>p.type==="hour")||{value:"0"}).value,10);
    const curM = parseInt((parts.find(p=>p.type==="minute")||{value:"0"}).value,10);
    const curMin = curH*60 + curM; const cutMin = sh*60 + sm;
    return curMin < cutMin;
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
