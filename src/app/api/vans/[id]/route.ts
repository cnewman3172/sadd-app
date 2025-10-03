import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { captureError } from '@/lib/obs';
import { publish } from '@/lib/events';
import { logAudit } from '@/lib/audit';
import { isMissingTableError } from '@/lib/prismaErrors';

export const runtime = 'nodejs';

const putSchema = z.object({
  status: z.enum(['ACTIVE','MAINTENANCE','OFFLINE']).optional(),
  capacity: z.coerce.number().int().min(1).max(16).optional(),
  passengers: z.coerce.number().int().min(0).max(99).optional(),
  activeTcId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).optional(),
});

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'DISPATCHER' && payload.role !== 'TC')) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { id } = await context.params;
  try{
    const payloadBody = putSchema.parse(await req.json());
    const van = await prisma.$transaction(async(tx)=>{
      const data: any = {};
      if (payloadBody.capacity !== undefined) data.capacity = payloadBody.capacity;
      if (payloadBody.passengers !== undefined) data.passengers = payloadBody.passengers;
      if (payloadBody.activeTcId !== undefined) data.activeTcId = payloadBody.activeTcId;
      if (payloadBody.name !== undefined) data.name = payloadBody.name;
      if (payloadBody.status !== undefined){
        data.status = payloadBody.status;
        if (payloadBody.status === 'OFFLINE'){
          data.activeTcId = null;
          data.passengers = 0;
        }
      }
      const updated = await tx.van.update({ where: { id }, data });
      if (payloadBody.status === 'OFFLINE'){
        try{
          await tx.vanTask.deleteMany({ where: { vanId: id } });
        }catch(err){
          if (!isMissingTableError(err)) throw err;
        }
        await tx.tcTransfer.updateMany({ where: { vanId: id, status: 'PENDING' }, data: { status: 'CANCELLED', respondedAt: new Date() } });
      }
      return updated;
    });
    publish('vans:update', { id: van.id });
    if (payloadBody.status === 'OFFLINE'){
      publish('transfer:update', { vanId: id, type: 'bulk-cancelled' });
    }
    logAudit('van_update', payload.uid, van.id, payloadBody);
    return NextResponse.json(van);
  }catch(e:any){
    captureError(e, { route: 'vans/update', vanId: id, uid: payload.uid });
    return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'DISPATCHER')) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { id } = await context.params;
  try{
    await prisma.van.delete({ where: { id } });
    publish('vans:update', { id, deleted: true });
    logAudit('van_delete', payload.uid, id);
    return NextResponse.json({ ok:true });
  }catch(e:any){
    captureError(e, { route: 'vans/delete', vanId: id, uid: payload.uid });
    return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 400 });
  }
}
