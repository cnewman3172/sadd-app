import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseMeta(notes){
  if (typeof notes !== 'string') return {};
  const trimmed = notes.trim();
  if (!trimmed.startsWith('{')) return {};
  try{ return JSON.parse(trimmed); }catch{ return {}; }
}

function needsWalkOnMeta(meta){
  if (!meta) return true;
  if (!meta.walkOnTc) return true;
  const tc = meta.walkOnTc;
  return !(tc.firstName && tc.lastName && tc.email);
}

function mergeWalkOnTc(meta, user){
  if (!user) return meta;
  const next = { ...meta };
  const tc = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
  };
  if (next.walkOnTc){
    next.walkOnTc = { ...tc, ...next.walkOnTc };
  }else{
    next.walkOnTc = tc;
  }
  return next;
}

async function main(){
  const candidateRides = await prisma.ride.findMany({
    where: {
      OR: [
        { driverId: null },
        { coordinatorId: null },
        { notes: { equals: 'WALK_ON' } },
        { notes: { contains: 'manualContact' } },
      ],
    },
    select: { id: true, driverId: true, coordinatorId: true, notes: true },
  });

  if (candidateRides.length === 0){
    console.log('No rides needing backfill');
    return;
  }

  const rideIds = candidateRides.map(r => r.id);
  const audits = await prisma.audit.findMany({
    where: { action: 'ride_create_walkon', subject: { in: rideIds } },
    orderBy: { createdAt: 'asc' },
  });
  const auditsByRide = new Map();
  const actorIds = new Set();
  for (const audit of audits){
    if (!audit.subject) continue;
    if (!auditsByRide.has(audit.subject)) auditsByRide.set(audit.subject, audit);
    if (audit.actorId) actorIds.add(audit.actorId);
  }

  const actors = actorIds.size ? await prisma.user.findMany({
    where: { id: { in: Array.from(actorIds) } },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  }) : [];
  const actorById = new Map(actors.map(u => [u.id, u]));

  let updated = 0;
  for (const ride of candidateRides){
    const audit = auditsByRide.get(ride.id);
    const actor = audit?.actorId ? actorById.get(audit.actorId) : null;
    const originalMeta = parseMeta(ride.notes);
    let meta = originalMeta ? { ...originalMeta } : {};
    let changed = false;
    const data = {};

    if (actor){
      if (!ride.driverId){ data.driverId = actor.id; changed = true; }
      if (!ride.coordinatorId){ data.coordinatorId = actor.id; changed = true; }
      if (needsWalkOnMeta(meta)){
        meta = mergeWalkOnTc(meta, actor);
        changed = true;
      }
    }

    if (Object.keys(meta).length > 0){
      const nextNotes = JSON.stringify(meta);
      if (nextNotes !== ride.notes){
        data.notes = nextNotes;
        changed = true;
      }
    }

    if (changed){
      await prisma.ride.update({ where: { id: ride.id }, data });
      updated += 1;
    }
  }

  console.log(`Processed ${candidateRides.length} rides; updated ${updated}.`);
}

main().catch((err)=>{
  console.error(err);
  process.exit(1);
}).finally(()=> prisma.$disconnect());

