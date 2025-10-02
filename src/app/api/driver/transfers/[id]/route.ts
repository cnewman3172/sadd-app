import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { publish } from '@/lib/events';
import { logAudit } from '@/lib/audit';
import { captureError } from '@/lib/obs';
import { z } from 'zod';

export const runtime = 'nodejs';

const actionSchema = z.object({ action: z.enum(['ACCEPT','DECLINE','CANCEL']) });

function isPrivileged(role: string){
  return role === 'ADMIN' || role === 'DISPATCHER';
}

function displayName(user?: { firstName?: string | null; lastName?: string | null }){
  const first = (user?.firstName || '').trim();
  const last = (user?.lastName || '').trim();
  return `${first} ${last}`.trim();
}

function serializeTransfer(t: any){
  return {
    id: t.id,
    status: t.status,
    note: t.note,
    vanId: t.vanId,
    vanName: t.van?.name || '',
    vanStatus: t.van?.status || 'OFFLINE',
    fromTcId: t.fromTcId,
    fromTcName: displayName(t.fromTc),
    toTcId: t.toTcId,
    toTcName: displayName(t.toTc),
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    respondedAt: t.respondedAt instanceof Date ? t.respondedAt.toISOString() : t.respondedAt,
  };
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['ADMIN','DISPATCHER','TC'].includes(payload.role)){
    return NextResponse.json({ error:'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await req.json().catch(()=> ({}));
  let action: 'ACCEPT'|'DECLINE'|'CANCEL';
  try{
    ({ action } = actionSchema.parse(body));
  }catch(e:any){
    return NextResponse.json({ error: e?.message || 'invalid request' }, { status: 400 });
  }
  try{
    switch(action){
      case 'ACCEPT': {
        const result = await prisma.$transaction(async(tx)=>{
          const transfer = await tx.tcTransfer.findUnique({
            where: { id },
            include: {
              van: { select: { id: true, name: true, status: true, activeTcId: true } },
              fromTc: { select: { id: true, firstName: true, lastName: true } },
              toTc: { select: { id: true, firstName: true, lastName: true } },
            }
          });
          if (!transfer) return { error:'Transfer not found' } as const;
          if (transfer.status !== 'PENDING') return { error:'Transfer already resolved' } as const;
          const actingAsOwner = payload.uid === transfer.fromTcId;
          if (!actingAsOwner && !isPrivileged(payload.role)) return { error:'Only the active TC can accept' } as const;
          if (!transfer.van || transfer.van.activeTcId !== transfer.fromTcId){
            return { error:'Van controller changed, refresh and try again.' } as const;
          }
          // Ensure the incoming TC is not attached to another van
          await tx.van.updateMany({
            where: { activeTcId: transfer.toTcId, NOT: { id: transfer.vanId } },
            data: { activeTcId: null, status: 'OFFLINE', passengers: 0 },
          });
          const updatedTransfer = await tx.tcTransfer.update({
            where: { id },
            data: { status: 'ACCEPTED', respondedAt: new Date() },
            include: {
              van: { select: { id: true, name: true, status: true } },
              fromTc: { select: { firstName: true, lastName: true } },
              toTc: { select: { firstName: true, lastName: true } },
            }
          });
          const updated = await tx.van.updateMany({
            where: { id: transfer.vanId, activeTcId: transfer.fromTcId },
            data: { activeTcId: transfer.toTcId, status: 'ACTIVE' },
          });
          if (updated.count === 0){
            return { error:'Van controller changed, refresh and try again.' } as const;
          }
          return { transfer: updatedTransfer } as const;
        });
        if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
        publish('transfer:update', { id, status: result.transfer.status, vanId: result.transfer.vanId, type: 'accepted' });
        publish('vans:update', { id: result.transfer.vanId });
        logAudit('tc_transfer_accept', payload.uid, result.transfer.vanId, { transferId: id });
        return NextResponse.json({ request: serializeTransfer(result.transfer) });
      }
      case 'DECLINE': {
        const transfer = await prisma.tcTransfer.findUnique({
          where: { id },
          include: { van: { select: { id: true, name: true, status: true } }, fromTc: { select: { id: true, firstName: true, lastName: true } }, toTc: { select: { firstName: true, lastName: true } } }
        });
        if (!transfer) return NextResponse.json({ error:'Transfer not found' }, { status: 404 });
        const actingAsOwner = payload.uid === transfer.fromTcId;
        if (!actingAsOwner && !isPrivileged(payload.role)) return NextResponse.json({ error:'Only the active TC can decline' }, { status: 403 });
        if (transfer.status !== 'PENDING') return NextResponse.json({ error:'Transfer already resolved' }, { status: 400 });
        const updated = await prisma.tcTransfer.update({
          where: { id },
          data: { status: 'DECLINED', respondedAt: new Date() },
          include: { van: { select: { id: true, name: true, status: true } }, fromTc: { select: { firstName: true, lastName: true } }, toTc: { select: { firstName: true, lastName: true } } }
        });
        publish('transfer:update', { id, status: updated.status, vanId: updated.vanId, type: 'declined' });
        logAudit('tc_transfer_decline', payload.uid, updated.vanId, { transferId: id });
        return NextResponse.json({ request: serializeTransfer(updated) });
      }
      case 'CANCEL': {
        const transfer = await prisma.tcTransfer.findUnique({
          where: { id },
          include: { van: { select: { id: true, name: true, status: true } }, toTc: { select: { id: true, firstName: true, lastName: true } }, fromTc: { select: { firstName: true, lastName: true } } }
        });
        if (!transfer) return NextResponse.json({ error:'Transfer not found' }, { status: 404 });
        const actingAsRequester = payload.uid === transfer.toTcId;
        if (!actingAsRequester && !isPrivileged(payload.role)) return NextResponse.json({ error:'Only the requesting TC can cancel' }, { status: 403 });
        if (transfer.status !== 'PENDING') return NextResponse.json({ error:'Transfer already resolved' }, { status: 400 });
        const updated = await prisma.tcTransfer.update({
          where: { id },
          data: { status: 'CANCELLED', respondedAt: new Date() },
          include: { van: { select: { id: true, name: true, status: true } }, fromTc: { select: { firstName: true, lastName: true } }, toTc: { select: { firstName: true, lastName: true } } }
        });
        publish('transfer:update', { id, status: updated.status, vanId: updated.vanId, type: 'cancelled' });
        logAudit('tc_transfer_cancel', payload.uid, updated.vanId, { transferId: id });
        return NextResponse.json({ request: serializeTransfer(updated) });
      }
      default:
        return NextResponse.json({ error:'unsupported action' }, { status: 400 });
    }
  }catch(e:any){
    captureError(e, { route: 'driver/transfers/action', transferId: id, uid: payload.uid });
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
