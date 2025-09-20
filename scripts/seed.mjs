import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main(){
  // Ensure singleton Setting row exists
  await prisma.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1, active: false } })

  // Optionally create a starter van if none exist
  const vanCount = await prisma.van.count()
  if (vanCount === 0) {
    await prisma.van.create({ data: { name: 'Alpha', capacity: 8 } })
  }
}

main().catch((e)=>{ console.error(e); process.exit(1) }).finally(()=> prisma.$disconnect())

