import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// One-time bootstrap endpoint to promote a user to a role (default ADMIN)
// Guarded by SETUP_KEY header. Remove/rotate SETUP_KEY after initial setup.
export async function POST(req: Request){
  const key = process.env.SETUP_KEY;
  if (!key) return NextResponse.json({ error: 'setup disabled' }, { status: 404 });
  const provided = req.headers.get('x-setup-key');
  if (provided !== key) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { email, role='ADMIN' } = await req.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
  const user = await prisma.user.update({ where: { email }, data: { role } });
  return NextResponse.json({ ok:true, id: user.id, role: user.role });
}

