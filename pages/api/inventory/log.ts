import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'BIOTECHNOLOGIST' && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method === 'POST') {
    const { itemId, requestId, quantityUsed, purpose } = req.body as {
      itemId: number
      requestId?: number
      quantityUsed: number
      purpose: string
    }

    const userId = (session.user as Record<string, unknown>)?.id as string

    if (!itemId || !quantityUsed || !purpose) {
      return res.status(400).json({ error: 'itemId, quantityUsed, and purpose are required' })
    }
    if (quantityUsed <= 0) {
      return res.status(400).json({ error: 'quantityUsed must be greater than zero' })
    }

    const result = await prisma.$transaction([
      prisma.reagentLog.create({
        data: {
          itemId,
          requestId: requestId ?? null,
          usedById: parseInt(userId),
          quantityUsed,
          purpose,
        }
      }),
      prisma.inventoryItem.update({
        where: { id: itemId },
        data: { quantity: { decrement: quantityUsed } }
      })
    ])

    return res.status(201).json(result)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}