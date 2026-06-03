import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin only' })
  }

  if (req.method !== 'GET') return res.status(405).end()

  const { action, from, to } = req.query
  const where: Record<string, unknown> = {}

  if (action && action !== 'ALL') where.action = action
  if (from || to) {
    where.performedAt = {
      ...(from ? { gte: new Date(from as string) } : {}),
      ...(to   ? { lte: new Date(to   as string) } : {}),
    }
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      performedBy: { select: { name: true, role: true } }
    },
    orderBy: { performedAt: 'desc' },
    take: 300,
  })

  return res.status(200).json(logs)
}