// pages/api/inventory/forecast.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export type ForecastItem = {
  id: number; name: string; unit: string; currentStock: number
  avgDailyUse: number; daysUntilEmpty: number | null
  projectedStockAt30: number; projectedStockAt60: number; projectedStockAt90: number
  labName: string; threshold: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()
  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'INVENTORY_MANAGER' && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (req.method !== 'GET') return res.status(405).end()

  const items = await prisma.inventoryItem.findMany({
    include: { lab: { select: { name: true } } }
  })

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const usage = await prisma.reagentLog.groupBy({
    by: ['itemId'],
    where: { usedAt: { gte: since } },
    _sum: { quantityUsed: true }
  })
  const usageMap = new Map(usage.map(u => [u.itemId, u._sum.quantityUsed ?? 0]))

  const forecast: ForecastItem[] = items.map(item => {
    const totalUsed30  = usageMap.get(item.id) ?? 0
    const avgDailyUse  = totalUsed30 / 30
    const daysUntilEmpty = avgDailyUse > 0 ? Math.floor(item.quantity / avgDailyUse) : null
    // FIX: was returning lowStockThreshold (nullable) while declared policy is that
    // minThreshold is the primary low-stock boundary. Return the same effective
    // threshold used by alerts.ts and inventory/index.ts: lowStockThreshold ?? minThreshold.
    const effectiveThreshold = item.lowStockThreshold ?? item.minThreshold
    return {
      id: item.id, name: item.name, unit: item.unit,
      currentStock: item.quantity, avgDailyUse: parseFloat(avgDailyUse.toFixed(3)),
      daysUntilEmpty,
      projectedStockAt30: Math.max(0, parseFloat((item.quantity - avgDailyUse * 30).toFixed(2))),
      projectedStockAt60: Math.max(0, parseFloat((item.quantity - avgDailyUse * 60).toFixed(2))),
      projectedStockAt90: Math.max(0, parseFloat((item.quantity - avgDailyUse * 90).toFixed(2))),
      labName: item.lab.name, threshold: effectiveThreshold,
    }
  })

  forecast.sort((a, b) => {
    if (a.daysUntilEmpty === null && b.daysUntilEmpty === null) return 0
    if (a.daysUntilEmpty === null) return 1
    if (b.daysUntilEmpty === null) return -1
    return a.daysUntilEmpty - b.daysUntilEmpty
  })
  return res.status(200).json(forecast)
}