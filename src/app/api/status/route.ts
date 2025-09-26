import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(){
  try{
    const setting = await prisma.setting.findUnique({ where: { id: 1 } }).catch(()=>null);
    function isActive(){
      const base = Boolean(setting?.active);
      if (!base) return false;
      if (!setting?.autoDisableEnabled) return base;
      const since = (setting?.scheduleSince ? new Date(setting.scheduleSince) : (setting?.activeSince ? new Date(setting.activeSince) : null));
      if (!since) return base;
      const tz = setting?.autoDisableTz || 'America/Anchorage';
      const hhmm = String(setting?.autoDisableTime || '22:00');
      const sh = parseInt(hhmm.split(':')[0]||'0',10);
      const sm = parseInt(hhmm.split(':')[1]||'0',10);
      const cut = sh*60 + sm;
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
        return { dayIndex, min };
      };
      const a = getLocal(since);
      const n = getLocal(new Date());
      if (a.dayIndex === n.dayIndex){
        return a.min < cut && n.min >= cut ? false : true;
      }
      const dayDiff = n.dayIndex - a.dayIndex;
      if (dayDiff === 1){
        if (a.min >= cut && n.min < cut) return true;
        return false;
      }
      return false;
    }
    const body = { active: isActive() };
    return new NextResponse(JSON.stringify(body), { status: 200, headers: { 'Content-Type':'application/json', 'Cache-Control':'public, max-age=120, s-maxage=120' } });
  }catch{
    return NextResponse.json({ active: false });
  }
}

