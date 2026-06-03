import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const r = await p.request.updateMany({ where: { archived: { equals: false } }, data: { archived: false } })
console.log('Fixed:', r.count)
await p.$disconnect()
