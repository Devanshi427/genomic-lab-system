// pages/api/inventory/alerts.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export type InventoryAlert = {
  id: number
  name: string
  quantity: number
  unit: string
  labName: string
  type: 'LOW_STOCK' | 'EXPIRY'
  detail: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'INVENTORY_MANAGER' && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const items = await prisma.inventoryItem.findMany({
    include: { lab: { select: { name: true } } }
  })

  const alerts: InventoryAlert[] = []
  const now = new Date()
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  for (const item of items) {
    // Use minThreshold as the primary low-stock boundary throughout the system.
    // lowStockThreshold is an optional per-item override; falls back to minThreshold
    // when null so that both surfaces (alerts banner and inventory table) agree.
    // FIX: was using <= here while inventory/index.ts used <, causing the same item
    // to appear OK in the table and alarming in the banner simultaneously.
    // Both surfaces now use strictly-less-than (<).
    const effectiveThreshold = item.lowStockThreshold ?? item.minThreshold

    if (item.quantity < effectiveThreshold) {
      alerts.push({
        id:       item.id,
        name:     item.name,
        quantity: item.quantity,
        unit:     item.unit,
        labName:  item.lab.name,
        type:     'LOW_STOCK',
        detail:   `Only ${item.quantity} ${item.unit} remaining (threshold: ${effectiveThreshold})`,
      })
    }

    if (item.expiryDate && item.expiryDate <= thirtyDaysOut) {
      const daysLeft = Math.ceil((item.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      alerts.push({
        id:       item.id,
        name:     item.name,
        quantity: item.quantity,
        unit:     item.unit,
        labName:  item.lab.name,
        type:     'EXPIRY',
        detail:   daysLeft <= 0
          ? `Expired on ${item.expiryDate.toLocaleDateString()}`
          : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      })
    }
  }

  return res.status(200).json(alerts)
}