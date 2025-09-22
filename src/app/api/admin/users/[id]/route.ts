import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { captureError } from '@/lib/obs';
import { logAudit } from '@/lib/audit';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });

  const { id } = await context.params;
  const schema = z.object({ role: z.enum(['ADMIN','COORDINATOR','TC','VOLUNTEER','RIDER']) });
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

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { id } = await context.params;
  try{
    // Soft-delete: disable login and scramble password; keep data and identity intact.
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ ok:true });
    if (user.email === 'unlinked@sadd.local'){
      return NextResponse.json({ error: 'Cannot delete the system Unlinked Rider account.' }, { status: 400 });
    }
    const hash = await bcrypt.hash(Math.random().toString(36).slice(2), 10);
    await prisma.$transaction(async(tx)=>{
      // Set any active TC van offline
      await tx.van.updateMany({ where: { activeTcId: id }, data: { activeTcId: null, status: 'OFFLINE', passengers: 0 } });
      // Disable user and scramble password
      await tx.user.update({ where: { id }, data: { disabled: true, password: hash } });
    });
    await logAudit('user_disable', payload.uid, id);
    return NextResponse.json({ ok:true, disabled:true });
  }catch(e:any){
    captureError(e, { route: 'admin/users/[id]#DELETE', id, uid: payload.uid });
    return NextResponse.json({ error: e?.message || 'delete failed' }, { status: 400 });
  }
}
