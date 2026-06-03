// pages/api/dashboard/timeline.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()
  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'MANAGEMENT' && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (req.method !== 'GET') return res.status(405).end()

  const months: Array<{ label: string; submitted: number; completed: number }> = []

  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)

    const [submitted, completed] = await Promise.all([
      prisma.request.count({ where: { submittedAt: { gte: start, lte: end } } }),
      prisma.request.count({ where: { status: 'COMPLETED', completedAt: { gte: start, lte: end } } }),
    ])

    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    months.push({ label, submitted, completed })
  }
  return res.status(200).json(months)
}
