// pages/api/dashboard/lab-comparison.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()
  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== "MANAGEMENT" && role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" })
  }
  if (req.method !== "GET") return res.status(405).end()

  const { months = "3" } = req.query
  const monthCount = parseInt(months as string) || 3
  const since = new Date(Date.now() - monthCount * 30 * 24 * 60 * 60 * 1000)

  // Get labs
  const labs = await prisma.lab.findMany({ select: { id: true, name: true } })

  // For each lab, sum reagent usage in the period
  const results = await Promise.all(labs.map(async lab => {
    // Get inventory items belonging to this lab
    const items = await prisma.inventoryItem.findMany({
      where: { labId: lab.id },
      select: { id: true, name: true }
    })
    const itemIds = items.map(i => i.id)

    // Get top 5 reagents by usage for this lab
    const usage = await prisma.reagentLog.groupBy({
      by: ["itemId"],
      where: {
        itemId: { in: itemIds },
        usedAt: { gte: since }
      },
      _sum: { quantityUsed: true },
      orderBy: { _sum: { quantityUsed: "desc" } },
      take: 5
    })

    const totalUsage = usage.reduce((sum, u) => sum + (u._sum.quantityUsed ?? 0), 0)

    const topReagents = usage.map(u => {
      const item = items.find(i => i.id === u.itemId)
      return {
        name:  item?.name ?? "Unknown",
        total: u._sum.quantityUsed ?? 0
      }
    })

    return { labId: lab.id, labName: lab.name, totalUsage, topReagents }
  }))

  return res.status(200).json(results)
}
