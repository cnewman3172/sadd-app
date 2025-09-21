import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { verifyJwt } from '@/lib/jwt';
import { captureError } from '@/lib/obs';

export const runtime = 'nodejs';

export async function POST(req: NextRequest){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const { to } = await req.json().catch(()=>({ to: '' }));
  if (!to) return NextResponse.json({ error:'missing to' }, { status: 400 });

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT||'0')||587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'SADD <no-reply@sadd.local>';
  if (!host || !user || !pass){
    return NextResponse.json({ ok:false, error:'smtp_not_configured', details:{ host: !!host, user: !!user, pass: !!pass } }, { status: 400 });
  }
  const debug = /^1|true$/i.test(process.env.SMTP_DEBUG||'');
  const transporter = nodemailer.createTransport({ host, port, secure: port===465, auth: { user, pass }, logger: debug, debug });
  try{
    const info = await transporter.sendMail({ from, to, subject: 'SMTP test from SADD', text: 'This is a test email confirming SMTP settings are working.' });
    return NextResponse.json({ ok:true, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
  }catch(e:any){
    captureError(e, { route: 'admin/smtp-test', host, port });
    return NextResponse.json({ ok:false, error: e?.message || 'send_failed' }, { status: 500 });
  }
}

