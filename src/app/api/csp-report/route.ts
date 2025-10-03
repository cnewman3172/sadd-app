import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (body) {
      console.warn('[CSP] Violation report received', body);
    }
  } catch (error) {
    console.warn('[CSP] Failed to process violation report', error);
  }

  return NextResponse.json({ ok: true }, { status: 204 });
}

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 204 });
}
