import { prisma } from '@/lib/prisma';

export async function logAudit(action: string, actorId?: string, subject?: string, details?: any){
  try{
    await prisma.audit.create({ data: { action, actorId, subject, details } });
  }catch{
    // ignore logging errors
  }
}

