import { NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';

export async function POST(req: Request){
  const body = await req.json();
  const { email, password, firstName, lastName, rank, unit, phone } = body;
  try{
    const user = await registerUser({ email, password, firstName, lastName, rank, unit, phone });
    return NextResponse.json({ id: user.id });
  }catch(e:any){
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
