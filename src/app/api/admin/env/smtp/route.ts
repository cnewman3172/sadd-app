import { NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error:'forbidden' }, { status: 403 });
  const host = process.env.SMTP_HOST || '';
  const port = process.env.SMTP_PORT || '';
  const user = process.env.SMTP_USER || '';
  const from = process.env.SMTP_FROM || '';
  const debug = process.env.SMTP_DEBUG || '';
  return NextResponse.json({
    ok: true,
    detected: {
      host: host || null,
      port: port || null,
      userPresent: Boolean(user),
      fromPresent: Boolean(from),
      debug,
    }
  });
}

