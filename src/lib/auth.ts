import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { signJwt, verifyJwt, type JwtPayload } from './jwt';

export async function registerUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  rank?: string;
  unit?: string;
  phone?: string;
}) {
  const hash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: { ...data, password: hash, role: 'RIDER' },
  });
  return user;
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.disabled) return null;
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;
  const token = await signJwt({ uid: user.id, role: user.role } as JwtPayload);
  return { token, user };
}

export function verifyToken(token?: string) {
  // Keep sync wrapper for existing callers
  // Note: prefer using verifyJwt directly when possible
  let payload: JwtPayload | null = null;
  // jose verify is async; we synchronously kick it off and block via Atomics if needed
  // but for simplicity in Node routes, callers should switch to verifyJwt.
  // Here we just return null to avoid edge usage in middleware.
  return payload;
}
