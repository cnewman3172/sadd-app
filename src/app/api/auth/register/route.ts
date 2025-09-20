import { NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';
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
    const body = await req.json();
    const { email, password, firstName, lastName, rank, unit, phone } = schema.parse(body);
    const user = await registerUser({ email, password, firstName, lastName, rank, unit, phone });
    return NextResponse.json({ id: user.id });
  }catch(e:any){
    const msg = e?.issues?.[0]?.message || e?.message || 'Registration failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
