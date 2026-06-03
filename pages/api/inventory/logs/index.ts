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

  const { from, to, itemId } = req.query

  const where: Record<string, unknown> = {}

  if (from || to) {
    where.usedAt = {
      ...(from ? { gte: new Date(from as string) } : {}),
      ...(to   ? { lte: new Date(to   as string) } : {}),
    }
  }

  if (itemId) {
    where.itemId = parseInt(itemId as string)
  }

  const logs = await prisma.reagentLog.findMany({
    where,
    include: {
      item:    { select: { name: true, unit: true } },
      usedBy:  { select: { name: true } },
      request: { select: { requestCode: true, sampleName: true } }, // nullable — returns null if no request
    },
    orderBy: { usedAt: 'desc' },
    take: 200,
  })

  // Normalise: attach cluster info for logs that have no request
  const logsWithCluster = await Promise.all(
    logs.map(async (log) => {
      if (log.request) return { ...log, cluster: null }

      // Find the ConsumptionDeduction that produced this log entry
      // matched by itemId, performedById, and closest usedAt timestamp
      const deduction = await prisma.consumptionDeduction.findFirst({
        where: {
          performedById: log.usedById,
          performedAt: {
            gte: new Date(new Date(log.usedAt).getTime() - 5000),
            lte: new Date(new Date(log.usedAt).getTime() + 5000),
          },
        },
        include: {
          cluster: { select: { name: true } },
        },
        orderBy: { performedAt: 'desc' },
      })

      return {
        ...log,
        cluster: deduction?.cluster ?? null,
      }
    })
  )

  return res.status(200).json(logsWithCluster)
}