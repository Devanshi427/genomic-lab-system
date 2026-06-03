// prisma/clear.ts
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.reagentLog.deleteMany({})
  await prisma.inventoryTransfer.deleteMany({})
  await prisma.inventoryItem.deleteMany({})
  await prisma.phaseHistory.deleteMany({})
  await prisma.auditLog.deleteMany({})
  await prisma.request.deleteMany({})
  await prisma.auditLog.deleteMany({})

  // Reset PostgreSQL sequences
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "ReagentLog_id_seq" RESTART WITH 1`)
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "InventoryTransfer_id_seq" RESTART WITH 1`)
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "InventoryItem_id_seq" RESTART WITH 1`)
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Request_id_seq" RESTART WITH 1`)
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "PhaseHistory_id_seq" RESTART WITH 1`)

  console.log('✅ Cleared and reset ID sequences')
}

main().catch(console.error).finally(() => prisma.$disconnect())