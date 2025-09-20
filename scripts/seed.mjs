import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()

async function main(){
  // Ensure singleton Setting row exists
  await prisma.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1, active: false } })

  // Optionally create a starter van if none exist
  const vanCount = await prisma.van.count()
  if (vanCount === 0) {
    await prisma.van.create({ data: { name: 'Alpha', capacity: 8 } })
  }

  // Optional users via env
  const adminEmail = process.env.SEED_ADMIN_EMAIL
  const coordEmail = process.env.SEED_COORD_EMAIL
  const tcEmail = process.env.SEED_TC_EMAIL
  const defaultPass = process.env.SEED_PASSWORD || 'ChangeMe!123'

  async function upsertUser(email, role, firstName){
    if (!email) return
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return existing
    const hash = await bcrypt.hash(defaultPass, 10)
    return prisma.user.create({ data: { email, password: hash, firstName, lastName: role, role } })
  }
  await upsertUser(adminEmail, 'ADMIN', 'Admin')
  await upsertUser(coordEmail, 'COORDINATOR', 'Coord')
  await upsertUser(tcEmail, 'TC', 'TC')
}

main().catch((e)=>{ console.error(e); process.exit(1) }).finally(()=> prisma.$disconnect())
