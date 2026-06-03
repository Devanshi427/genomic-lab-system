import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
 
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()
 
  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'INVENTORY_MANAGER' && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' })
  }
 
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
 
  const transfers = await prisma.inventoryTransfer.findMany({
    where: { status: 'PENDING' },
    include: {
      fromItem: { include: { lab: { select: { name: true } } } },
      toItem:   { include: { lab: { select: { name: true } } } },
      requestedBy: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
 
  return res.status(200).json(transfers)
}
