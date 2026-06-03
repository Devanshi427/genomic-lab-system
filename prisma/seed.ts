import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('ENV CHECK:', process.env.DATABASE_URL)

  const lab1 = await prisma.lab.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Lab 1', location: 'Location 1' }
  })

  await prisma.lab.upsert({
    where: { id: 2 },
    update: {},
    create: { name: 'Lab 2', location: 'Location 2' }
  })

  const hashedPw = await bcrypt.hash('password123', 10)

  // BREEDER — submits and views all requests
  await prisma.user.upsert({
    where: { email: 'breeder1@lab.com' },
    update: { role: 'BREEDER' },
    create: {
      email: 'breeder1@lab.com',
      password: hashedPw,
      name: 'Breeder One',
      role: 'BREEDER'
    }
  })

  // BIOTECHNOLOGIST — advances phases, logs reagent usage
  await prisma.user.upsert({
    where: { email: 'biotechnologist1@lab.com' },
    update: { role: 'BIOTECHNOLOGIST' },
    create: {
      email: 'biotechnologist1@lab.com',
      password: hashedPw,
      name: 'Biotechnologist 1',
      role: 'BIOTECHNOLOGIST',
      labId: lab1.id
    }
  })

  // INVENTORY_MANAGER — manages stock, transfers, Excel import
  await prisma.user.upsert({
    where: { email: 'inv@lab.com' },
    update: { role: 'INVENTORY_MANAGER' },
    create: {
      email: 'inv@lab.com',
      password: hashedPw,
      name: 'Inventory Manager',
      role: 'INVENTORY_MANAGER',
      labId: lab1.id
    }
  })

  // MANAGEMENT — dashboard and requests read-only
  await prisma.user.upsert({
    where: { email: 'mgmt@lab.com' },
    update: { role: 'MANAGEMENT' },
    create: {
      email: 'mgmt@lab.com',
      password: hashedPw,
      name: 'Director',
      role: 'MANAGEMENT'
    }
  })

  // ADMIN — full access to everything
  await prisma.user.upsert({
    where: { email: 'admin@lab.com' },
    update: { role: 'ADMIN' },
    create: {
      email: 'admin@lab.com',
      password: hashedPw,
      name: 'System Admin',
      role: 'ADMIN'
    }
  })

  console.log('✅ Seed complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })