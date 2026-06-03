// pages/api/reports/monthly.ts
// FIX #3: This route was entirely missing. pages/reports/monthly.tsx fetches
// `/api/reports/monthly` for its summary data, but only the PDF endpoint existed.
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

type LabPerf = { labName: string; submitted: number; completed: number }
type TopReagent = { name: string; unit: string; totalUsed: number }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role = (session.user as Record<string, unknown>)?.role as string
if (!['MANAGEMENT', 'ADMIN', 'BIOTECHNOLOGIST'].includes(role)) {
  return res.status(403).json({ error: 'Forbidden' })
}

  if (req.method !== 'GET') return res.status(405).end()

  const now   = new Date()
  const year  = parseInt(req.query.year  as string) || now.getFullYear()
  const month = parseInt(req.query.month as string) || now.getMonth() + 1

  const start = new Date(year, month - 1, 1)
  const end   = new Date(year, month, 0, 23, 59, 59)

  // ── Core counts ──────────────────────────────────────────────────────────
  const [submitted, completedCount, allInMonth] = await Promise.all([
    prisma.request.count({ where: { submittedAt: { gte: start, lte: end } } }),
    prisma.request.count({ where: { status: 'COMPLETED', completedAt: { gte: start, lte: end } } }),
    prisma.request.findMany({
      where: { submittedAt: { gte: start, lte: end } },
      select: {
        id:             true,
        status:         true,
        currentPhase:   true,
        completedAt:    true,
        expectedByDate: true,
        submittedAt:    true,
        assignedLabId:  true,
        assignedLab:    { select: { name: true } },
      },
      orderBy: { submittedAt: 'asc' },
    }),
  ])

  // ── Completion rate ───────────────────────────────────────────────────────
  const completionRate = submitted > 0
    ? Math.round((completedCount / submitted) * 100)
    : 0

  // ── Average turnaround (days) for completed requests ──────────────────────
  const completedRequests = allInMonth.filter(r => r.status === 'COMPLETED' && r.completedAt)
  const avgTurnaroundDays = completedRequests.length > 0
    ? parseFloat(
        (
          completedRequests.reduce(
            (sum, r) =>
              sum + (r.completedAt!.getTime() - r.submittedAt.getTime()) / 86_400_000,
            0,
          ) / completedRequests.length
        ).toFixed(1)
      )
    : 0

  // ── On-time % ─────────────────────────────────────────────────────────────
  const onTimeCount = completedRequests.filter(
    r => new Date(r.completedAt!) <= new Date(r.expectedByDate)
  ).length
  const onTimePct = completedRequests.length > 0
    ? Math.round((onTimeCount / completedRequests.length) * 100)
    : 0

  // ── Performance by lab ────────────────────────────────────────────────────
  const labs = await prisma.lab.findMany({ select: { id: true, name: true } })

  const byLab: LabPerf[] = await Promise.all(
    labs.map(async lab => {
      const labRequests = allInMonth.filter(r => r.assignedLabId === lab.id)
      return {
        labName:   lab.name,
        submitted: labRequests.length,
        completed: labRequests.filter(r => r.status === 'COMPLETED').length,
      }
    })
  )

  // ── Top reagents consumed this month ──────────────────────────────────────
  interface ReagentUsageRow {
    itemId: number
    _sum: { quantityUsed: number | null }
  }

  const reagentUsage = (await prisma.reagentLog.groupBy({
    by:      ['itemId'],
    where:   { usedAt: { gte: start, lte: end } },
    _sum:    { quantityUsed: true },
    orderBy: { _sum: { quantityUsed: 'desc' } },
    take:    10,
  })) as unknown as ReagentUsageRow[]

  const itemIds = reagentUsage.map(u => u.itemId)
  const fetchedItems = await prisma.inventoryItem.findMany({
    where:  { id: { in: itemIds } },
    select: { id: true, name: true, unit: true },
  })

  const topReagents: TopReagent[] = reagentUsage.map(u => {
    const item = fetchedItems.find(i => i.id === u.itemId)
    return {
      name:      item?.name  ?? 'Unknown',
      unit:      item?.unit  ?? '',
      totalUsed: u._sum.quantityUsed ?? 0,
    }
  })

  // ── Phase distribution ────────────────────────────────────────────────────
  const byPhase: Record<string, number> = {}
  for (const r of allInMonth) {
    byPhase[r.currentPhase] = (byPhase[r.currentPhase] ?? 0) + 1
  }

  // ── Month label ───────────────────────────────────────────────────────────
  const monthName = start.toLocaleString('default', { month: 'long' })

  return res.status(200).json({
    month:             monthName,
    year,
    totalSubmitted:    submitted,
    totalCompleted:    completedCount,
    completionRate,
    avgTurnaroundDays,
    onTimePct,
    byLab,
    topReagents,
    byPhase,
  })
}