// pages/api/admin/user-activity.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()
  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'GET') return res.status(405).end()

  const userId = parseInt(req.query.userId as string)
  const page   = Math.max(1, parseInt(req.query.page  as string) || 1)
  const limit  = Math.min(100, parseInt(req.query.limit as string) || 25)
  const skip   = (page - 1) * limit

  if (isNaN(userId)) return res.status(400).json({ error: 'userId required' })

  const [user, entries, total] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, name: true, email: true, role: true},
    }),
    prisma.auditLog.findMany({
      where:   { performedById: userId },
      // Use the field name that Prisma actually generated.
      // If your schema column is `performedAt` change both here and below.
      orderBy: { performedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where: { performedById: userId } }),
  ])

  if (!user) return res.status(404).json({ error: 'User not found' })

  return res.status(200).json({ user, entries, total, page, limit })
}