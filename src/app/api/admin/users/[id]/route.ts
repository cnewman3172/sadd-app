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

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { id } = await context.params;
  try{
    // Prevent deleting the shared Unlinked Rider account
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ ok:true });
    if (user.email === 'unlinked@sadd.local'){
      return NextResponse.json({ error: 'Cannot delete the system Unlinked Rider account.' }, { status: 400 });
    }

    // Ensure Unlinked Rider exists
    let unlinked = await prisma.user.findUnique({ where: { email: 'unlinked@sadd.local' } });
    if (!unlinked){
      const hash = await bcrypt.hash(Math.random().toString(36).slice(2), 10);
      unlinked = await prisma.user.create({ data: { email: 'unlinked@sadd.local', password: hash, firstName: 'Unlinked', lastName: 'Rider', role: 'RIDER' } });
    }

    await prisma.$transaction(async(tx)=>{
      // Reassign rides to Unlinked Rider
      await tx.ride.updateMany({ where: { riderId: id }, data: { riderId: unlinked!.id } });
      // Clear as driver/coordinator where present
      await tx.ride.updateMany({ where: { driverId: id }, data: { driverId: null } });
      await tx.ride.updateMany({ where: { coordinatorId: id }, data: { coordinatorId: null } });
      // If TC currently active on a van, set van offline and clear
      await tx.van.updateMany({ where: { activeTcId: id }, data: { activeTcId: null, status: 'OFFLINE', passengers: 0 } });
      // Finally delete the user
      await tx.user.delete({ where: { id } });
    });
    await logAudit('user_delete', payload.uid, id, { reassignedTo: 'unlinked@sadd.local' });
    return NextResponse.json({ ok:true });
  }catch(e:any){
    captureError(e, { route: 'admin/users/[id]#DELETE', id, uid: payload.uid });
    return NextResponse.json({ error: e?.message || 'delete failed' }, { status: 400 });
  }
}
