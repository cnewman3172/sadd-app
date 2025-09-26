import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { z } from 'zod';
import { captureError } from '@/lib/obs';
import { logAudit } from '@/lib/audit';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { id } = await context.params;
  try{
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        // prerequisites
        vmisRegistered: true,
        volunteerAgreement: true,
        saddSopRead: true,
        // trainings
        trainingSafetyAt: true,
        trainingDriverAt: true,
        trainingTcAt: true,
        trainingDispatcherAt: true,
        // other
        checkRide: true,
        createdAt: true,
      }
    });
    if (!user) return NextResponse.json({ error:'not found' }, { status: 404 });
    return NextResponse.json(user);
  }catch(e:any){
    captureError(e, { route: 'admin/users/[id]#GET', id, uid: payload.uid });
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 400 });
  }
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });

  const { id } = await context.params;
  const schema = z.object({
    role: z.enum(['ADMIN','DISPATCHER','TC','DRIVER','SAFETY','RIDER']).optional(),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    rank: z.string().max(120).optional().nullable(),
    unit: z.string().max(120).optional().nullable(),
    phone: z.string().max(40).optional().nullable(),
    checkRide: z.boolean().optional(),
    trainingSafety: z.boolean().optional(),
    trainingDriver: z.boolean().optional(),
    trainingTc: z.boolean().optional(),
    trainingDispatcher: z.boolean().optional(),
    // admin-manageable prereqs
    vmisRegistered: z.boolean().optional(),
    volunteerAgreement: z.boolean().optional(),
    saddSopRead: z.boolean().optional(),
  });
  try{
    const body = schema.parse(await req.json());
    const data: any = {};
    if (body.role) data.role = body.role as any;
    if (body.firstName!=null) data.firstName = body.firstName;
    if (body.lastName!=null) data.lastName = body.lastName;
    if (body.rank!==undefined) data.rank = body.rank ?? null;
    if (body.unit!==undefined) data.unit = body.unit ?? null;
    if (body.phone!==undefined) data.phone = body.phone ?? null;
    if (body.checkRide!==undefined) data.checkRide = body.checkRide;
    if (body.vmisRegistered!==undefined) data.vmisRegistered = body.vmisRegistered;
    if (body.volunteerAgreement!==undefined) data.volunteerAgreement = body.volunteerAgreement;
    if (body.saddSopRead!==undefined) data.saddSopRead = body.saddSopRead;
    // Training flags: booleans set/clear timestamps
    const now = new Date();
    if (body.trainingSafety!==undefined) data.trainingSafetyAt = body.trainingSafety ? now : null;
    if (body.trainingDriver!==undefined) data.trainingDriverAt = body.trainingDriver ? now : null;
    if (body.trainingTc!==undefined) data.trainingTcAt = body.trainingTc ? now : null;
    if (body.trainingDispatcher!==undefined) data.trainingDispatcherAt = body.trainingDispatcher ? now : null;
    if (Object.keys(data).length === 0) return NextResponse.json({ error:'no changes' }, { status: 400 });
    const user = await prisma.user.update({ where: { id }, data });
    if (body.role) logAudit('user_role_update', payload.uid, id, { role: body.role });
    if (body.firstName || body.lastName || body.rank!==undefined || body.unit!==undefined || body.phone!==undefined){
      logAudit('user_profile_update', payload.uid, id, { firstName: body.firstName, lastName: body.lastName, rank: body.rank, unit: body.unit, phone: body.phone });
    }
    // Audit training and prerequisite changes explicitly for traceability
    const trainingChanges: Record<string, any> = {};
    if (body.trainingSafety!==undefined) trainingChanges.trainingSafety = body.trainingSafety;
    if (body.trainingDriver!==undefined) trainingChanges.trainingDriver = body.trainingDriver;
    if (body.trainingTc!==undefined) trainingChanges.trainingTc = body.trainingTc;
    if (body.trainingDispatcher!==undefined) trainingChanges.trainingDispatcher = body.trainingDispatcher;
    if (Object.keys(trainingChanges).length){
      logAudit('user_training_update', payload.uid, id, trainingChanges);
    }
    const prereqChanges: Record<string, any> = {};
    if (body.vmisRegistered!==undefined) prereqChanges.vmisRegistered = body.vmisRegistered;
    if (body.volunteerAgreement!==undefined) prereqChanges.volunteerAgreement = body.volunteerAgreement;
    if (body.saddSopRead!==undefined) prereqChanges.saddSopRead = body.saddSopRead;
    if (body.checkRide!==undefined) prereqChanges.checkRide = body.checkRide;
    if (Object.keys(prereqChanges).length){
      logAudit('user_prereq_update', payload.uid, id, prereqChanges);
    }
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
    const hash = await bcrypt.hash(Math.random().toString(36).slice(2), 12);
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
