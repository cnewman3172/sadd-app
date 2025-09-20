import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { captureError } from '@/lib/obs';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });

  const { id } = await context.params;
  const schema = z.object({ role: z.enum(['ADMIN','COORDINATOR','TC','RIDER']) });
  try{
    const { role } = schema.parse(await req.json());
    const user = await prisma.user.update({ where: { id }, data: { role } });
    logAudit('user_role_update', payload.uid, id, { role });
    return NextResponse.json({ ok:true, id: user.id, role: user.role });
  }catch(e:any){
    captureError(e, { route: 'admin/users/[id]#PUT', id, uid: payload.uid });
    return NextResponse.json({ error: e?.message || 'update failed' }, { status: 400 });
  }
}

