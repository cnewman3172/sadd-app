import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { publish } from '@/lib/events';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

export const runtime = 'nodejs';

const createSchema = z.object({
  vanId: z.string().uuid(),
  note: z.string().trim().min(1).max(500).optional(),
});

function isStaff(role: string){
  return ['ADMIN','DISPATCHER','TC'].includes(role);
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

export async function GET(req: NextRequest){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !isStaff(payload.role)) return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const transfers = await prisma.tcTransfer.findMany({
    where: { OR: [ { fromTcId: payload.uid }, { toTcId: payload.uid } ] },
    orderBy: { createdAt: 'desc' },
    include: {
      van: { select: { id: true, name: true, status: true } },
      fromTc: { select: { firstName: true, lastName: true } },
      toTc: { select: { firstName: true, lastName: true } },
    }
  });
  return NextResponse.json({ requests: transfers.map(serializeTransfer) });
}

export async function POST(req: NextRequest){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || !['TC','ADMIN','DISPATCHER'].includes(payload.role)) {
    return NextResponse.json({ error:'forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(()=> ({}));
  const { vanId, note } = createSchema.parse(body);
  const van = await prisma.van.findUnique({ where: { id: vanId } });
  if (!van) return NextResponse.json({ error:'van not found' }, { status: 404 });
  if (!van.activeTcId) return NextResponse.json({ error:'Van is not currently assigned' }, { status: 400 });
  if (van.activeTcId === payload.uid) return NextResponse.json({ error:'You already control this van' }, { status: 400 });
  const existing = await prisma.tcTransfer.findFirst({ where: { vanId, toTcId: payload.uid, status: 'PENDING' } });
  if (existing) return NextResponse.json({ error:'You already have a pending request for this van' }, { status: 409 });

  const transfer = await prisma.tcTransfer.create({
    data: {
      vanId,
      fromTcId: van.activeTcId,
      toTcId: payload.uid,
      note: note?.trim() || null,
    },
    include: {
      van: { select: { id: true, name: true, status: true } },
      fromTc: { select: { firstName: true, lastName: true } },
      toTc: { select: { firstName: true, lastName: true } },
    }
  });
  publish('transfer:update', { id: transfer.id, status: transfer.status, vanId: transfer.vanId, type: 'created' });
  logAudit('tc_transfer_request', payload.uid, transfer.vanId, { transferId: transfer.id });
  return NextResponse.json({ request: serializeTransfer(transfer) });
}
