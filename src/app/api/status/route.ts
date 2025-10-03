import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(){
  try{
    const setting = await prisma.setting.findUnique({ where: { id: 1 } }).catch(()=>null);
    // For public UI, reflect the configured Active toggle directly.
    // Auto-disable logic is enforced at request time (/api/rides/request) but not on the badge.
    const active = Boolean(setting?.active);
    return new NextResponse(JSON.stringify({ active }), { status: 200, headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store, max-age=0' } });
  }catch{
    return NextResponse.json({ active: false });
  }
}
