import { SignJWT, jwtVerify } from 'jose';

const encoder = new TextEncoder();
const secret = () => encoder.encode(process.env.JWT_SECRET || 'devsecret');

export type JwtPayload = { uid: string; role: string };

export async function signJwt(payload: JwtPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
}

export async function verifyJwt(token?: string): Promise<JwtPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

