import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

export type JwtPayload = {
  uid: string;
  role: string;
};

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
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;
  const token = jwt.sign({ uid: user.id, role: user.role } as JwtPayload, JWT_SECRET, { expiresIn: '7d' });
  return { token, user };
}

export function verifyToken(token?: string) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

