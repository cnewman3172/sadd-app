import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';

export type AppUser = Awaited<ReturnType<typeof getUser>>;

export async function getUser(){
  const jar = await cookies();
  const token = jar.get('sadd_token')?.value;
  const payload = await verifyJwt(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  return user;
}

export async function requireRoles(roles: string[]){
  const user = await getUser();
  if (!user) redirect('/login');
  if (!roles.includes(user.role)) redirect('/');
  return user;
}

export async function requireTrainingForShifts(user: NonNullable<AppUser>){
  if (user.role === 'ADMIN') return; // bypass
  const ok = (()=>{
    switch (user.role){
      case 'DISPATCHER': return Boolean((user as any).trainingDispatcherAt);
      case 'TC': return Boolean((user as any).trainingTcAt);
      case 'DRIVER': return Boolean((user as any).trainingDriverAt) && Boolean((user as any).checkRide);
      case 'SAFETY': return Boolean((user as any).trainingSafetyAt);
      default: return true;
    }
  })();
  if (!ok) redirect('/training');
}

export async function requireActiveShift(user: NonNullable<AppUser>, neededRole: 'DISPATCHER'|'TC'){
  if (user.role === 'ADMIN') return; // bypass
  const now = new Date();
  const s = await prisma.shift.findFirst({
    where: {
      role: neededRole,
      startsAt: { lte: now },
      endsAt: { gt: now },
      signups: { some: { userId: user.id } },
    },
    select: { id: true },
  });
  if (!s) redirect('/shifts');
}

