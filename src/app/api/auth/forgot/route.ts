import { NextResponse } from 'next/server';
import { z } from 'zod';
import { allowAuth } from '@/lib/ratelimit';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export async function POST(req: Request){
  const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  if (!allowAuth(ip)) return NextResponse.json({ error:'rate limited' }, { status: 429 });
  const schema = z.object({ email: z.string().email() });
  const { email } = schema.parse(await req.json());

  // Soft implementation: log the request; do not disclose existence.
  try{
    const user = await prisma.user.findUnique({ where: { email } });
    await logAudit('forgot_password_request', user?.id, email);
  }catch{}

  // Always respond success to avoid user enumeration.
  return NextResponse.json({ ok:true, message: 'If the email exists, you will receive reset instructions.' });
}

