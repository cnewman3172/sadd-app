import { NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';
import { allowAuth } from '@/lib/ratelimit';
import { captureError } from '@/lib/obs';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  rank: z.string().optional(),
  unit: z.string().optional(),
  phone: z.string().optional(),
});

export async function POST(req: Request){
  try{
    const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
    if (!allowAuth(ip)) return NextResponse.json({ error:'rate limited' }, { status: 429 });
    const body = await req.json();
    const { email, password, firstName, lastName, rank, unit, phone } = schema.parse(body);
    const user = await registerUser({ email, password, firstName, lastName, rank, unit, phone });
    return NextResponse.json({ id: user.id });
  }catch(e:any){
    captureError(e, { route: 'auth/register' });
    const msg = e?.issues?.[0]?.message || e?.message || 'Registration failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
