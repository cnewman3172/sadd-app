import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

function ensureConfigured(){
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  try{
    webpush.setVapidDetails('mailto:noreply@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    return true;
  }catch{ return false; }
}

export async function sendToUsers(userIds: string[], notif: { title: string; body?: string; tag?: string; data?: any }){
  if (!ensureConfigured()) return;
  if (!userIds.length) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  const payload = JSON.stringify({ title: notif.title, body: notif.body, tag: notif.tag, data: notif.data });
  await Promise.all(subs.map(async (s)=>{
    try{
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as any, payload);
    }catch(e: any){
      // Clean up stale subs
      if (e?.statusCode === 404 || e?.statusCode === 410){
        try{ await prisma.pushSubscription.delete({ where: { endpoint: s.endpoint } }); }catch{}
      }
    }
  }));
}

export async function getActiveUserIdsForRole(role: 'DISPATCHER'|'TC'){
  const now = new Date();
  const shifts = await prisma.shift.findMany({
    where: { role: role as any, startsAt: { lte: now }, endsAt: { gt: now } },
    include: { signups: { select: { userId: true } } },
  });
  const ids = new Set<string>();
  for (const s of shifts){ for (const su of s.signups){ ids.add(su.userId); } }
  return Array.from(ids);
}

export async function notifyOnShift(role: 'DISPATCHER'|'TC', notif: { title: string; body?: string; tag?: string; data?: any }){
  await notifyRoles([role], notif);
}

export async function notifyRoles(roles: Array<'DISPATCHER'|'TC'>, notif: { title: string; body?: string; tag?: string; data?: any }){
  const unique = new Set<string>();
  await Promise.all(roles.map(async(role)=>{
    const ids = await getActiveUserIdsForRole(role);
    ids.forEach(id=> unique.add(id));
  }));
  if (unique.size === 0) return;
  await sendToUsers(Array.from(unique), notif);
}
