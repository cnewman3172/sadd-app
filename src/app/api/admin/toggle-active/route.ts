import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { captureError } from '@/lib/obs';

export async function POST(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  try{
    // Ensure row exists
    let s = await prisma.setting.findUnique({ where: { id: 1 } });
    if (!s){ s = await prisma.setting.create({ data: { id:1, active:false } }); }
    const turningOn = !s.active;
    // When turning ON while auto-disable is enabled, anchor the schedule from now so it stays
    // active until the next cutoff time, then auto-disables as expected.
    const data: any = { active: turningOn, activeSince: turningOn ? new Date() : null };
    if (turningOn && s.autoDisableEnabled){
      data.scheduleSince = new Date();
    }
    const toggled = await prisma.setting.update({ where:{ id:1 }, data });
    return NextResponse.json(toggled);
  }catch(e:any){
    captureError(e, { route: 'admin/toggle-active', uid: payload.uid });
    return NextResponse.json({ error:'toggle failed' }, { status: 500 });
  }
}
