import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: NextRequest){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days')||'30')));
  const tz = url.searchParams.get('tz') || 'UTC';
  const start = new Date(Date.now() - days*24*60*60*1000);
  const shifts = await prisma.shift.findMany({
    where: { startsAt: { gte: start } },
    orderBy: { startsAt: 'asc' },
    include: { signups: true },
  });
  const byDay = new Map<string, { shifts:number; needed:number; signups:number }>();
  const fmt = (d: Date)=>{
    try{
      const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(d);
      const get=(t:string)=>parts.find(p=>p.type===t)?.value||''; return `${get('year')}-${get('month')}-${get('day')}`;
    }catch{ return d.toISOString().slice(0,10); }
  };
  for (const s of shifts){
    const key = fmt(s.startsAt);
    const row = byDay.get(key) || { shifts:0, needed:0, signups:0 };
    row.shifts += 1; row.needed += s.needed; row.signups += s.signups.length; byDay.set(key, row);
  }
  const out = Array.from(byDay.entries()).sort((a,b)=> a[0].localeCompare(b[0])).map(([day, r])=>({ day, shifts:r.shifts, needed:r.needed, signups:r.signups, coverage: r.needed>0 ? Math.round((r.signups/r.needed)*100) : null }));
  return NextResponse.json(out);
}

