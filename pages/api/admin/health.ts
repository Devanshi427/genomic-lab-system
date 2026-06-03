// pages/api/admin/health.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()
  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== "ADMIN") return res.status(403).json({ error: "Admin only" })
  if (req.method !== "GET") return res.status(405).end()

  const [
    userCount,
    requestCount,
    inventoryCount,
    reagentLogCount,
    auditCount,
    pendingTransfers,
    unassignedRequests,
    recentActivity
  ] = await Promise.all([
    prisma.user.count(),
    prisma.request.count(),
    prisma.inventoryItem.count(),
    prisma.reagentLog.count(),
    prisma.auditLog.count(),
    prisma.inventoryTransfer.count({ where: { status: "PENDING" } }),
    prisma.request.count({
      where: { assignedLabId: null, status: { not: "COMPLETED" } }
    }),
    prisma.auditLog.findMany({
      orderBy: { performedAt: "desc" },
      take: 5,
      include: { performedBy: { select: { name: true } } }
    })
  ])

  return res.status(200).json({
    counts: { userCount, requestCount, inventoryCount, reagentLogCount, auditCount },
    alerts: { pendingTransfers, unassignedRequests },
    recentActivity,
    generatedAt: new Date().toISOString()
  })
}
