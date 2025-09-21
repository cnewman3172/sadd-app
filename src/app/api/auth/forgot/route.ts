import { NextResponse } from 'next/server';
import { z } from 'zod';
import { allowAuth } from '@/lib/ratelimit';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export async function POST(req: Request){
  const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  if (!allowAuth(ip)) return NextResponse.json({ error:'rate limited' }, { status: 429 });
  const schema = z.object({ email: z.string().email() });
  const { email } = schema.parse(await req.json());

  try{
    const user = await prisma.user.findUnique({ where: { email } });
    await logAudit('forgot_password_request', user?.id, email);
    if (user){
      // create token expiring in 1 hour
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60*60*1000);
      await prisma.passwordReset.create({ data: { userId: user.id, token, expiresAt } });
      const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
      const link = `${origin.replace(/\/$/,'')}/reset?token=${encodeURIComponent(token)}`;
      // Send email if SMTP configured
      const host = process.env.SMTP_HOST;
      const port = Number(process.env.SMTP_PORT||'0')||587;
      const userS = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const from = process.env.SMTP_FROM || 'SADD <no-reply@sadd.local>';
      if (host && userS && pass){
        const transporter = nodemailer.createTransport({ host, port, secure: port===465, auth: { user: userS, pass } });
        await transporter.sendMail({ from, to: email, subject: 'Reset your SADD password', text: `Click the link to reset your password: ${link}`, html: `<p>Click the link to reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>` });
      } else {
        // In non-production without SMTP, include the link in the response to simplify testing
        if (process.env.NODE_ENV !== 'production'){
          return NextResponse.json({ ok:true, link, message: 'SMTP not configured; use provided link to reset.' });
        }
      }
    }
  }catch{}

  return NextResponse.json({ ok:true, message: 'If the email exists, you will receive reset instructions.' });
}
