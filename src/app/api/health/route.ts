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
    const since = setting?.activeSince ? new Date(setting.activeSince) : null;
    if (!since) return base;
    const tz = setting?.autoDisableTz || "America/Anchorage";
    const hhmm = String(setting?.autoDisableTime || "22:00");
    const sh = parseInt(hhmm.split(":")[0]||"0",10);
    const sm = parseInt(hhmm.split(":")[1]||"0",10);

    // Helper to extract local Y/M/D and minutes since midnight in a timezone
    const getLocal = (d: Date) => {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(d);
      const get = (t:string)=> (parts.find(p=>p.type===t)?.value)||'0';
      const y = parseInt(get('year'),10);
      const m = parseInt(get('month'),10);
      const da = parseInt(get('day'),10);
      const h = parseInt(get('hour'),10);
      const mi = parseInt(get('minute'),10);
      const min = h*60 + mi;
      const dayIndex = Math.floor(Date.UTC(y, m-1, da) / 86400000);
      return { y, m, da, min, dayIndex };
    };

    const now = new Date();
    const a = getLocal(since);
    const n = getLocal(now);
    const cut = sh*60 + sm;

    if (a.dayIndex === n.dayIndex){
      // Same local day: disable only if we crossed the cutoff since activation
      return a.min < cut && n.min >= cut ? false : true;
    }
    const dayDiff = n.dayIndex - a.dayIndex;
    if (dayDiff === 1){
      // Next local day: if activated after cutoff and it's before today's cutoff, not yet disabled
      if (a.min >= cut && n.min < cut) return true;
      return false;
    }
    // 2+ days later: cutoff definitely occurred
    return false;
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
