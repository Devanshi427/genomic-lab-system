// pages/api/approvals/index.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { writeAudit } from '../../../lib/audit'

declare const global: { io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } } }

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, NORMAL: 1, LOW: 2 }

async function recalculateQueuePositions() {
  const pending = await prisma.$queryRaw<Array<{
    id: number; approvalPriority: string; submittedAt: Date
  }>>`
    SELECT id, "approvalPriority", "submittedAt"
    FROM "Request"
    WHERE "approvalStatus" IN ('PENDING_APPROVAL', 'PARTIALLY_APPROVED', 'PARTIALLY_REJECTED')
  `

  const sorted = [...pending].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.approvalPriority] ?? 1
    const pb = PRIORITY_ORDER[b.approvalPriority] ?? 1
    if (pa !== pb) return pa - pb
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
  })

  for (let idx = 0; idx < sorted.length; idx++) {
    const pos = idx + 1
    await prisma.$executeRaw`
      UPDATE "Request" SET "queuePosition" = ${pos} WHERE id = ${sorted[idx].id}
    `
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role   = (session.user as Record<string, unknown>)?.role as string
  const userId = parseInt((session.user as Record<string, unknown>)?.id as string)

  const allowed = ['ADMIN', 'MANAGEMENT', 'BREEDER', 'BIOTECHNOLOGIST']
  if (!allowed.includes(role)) return res.status(403).json({ error: 'Forbidden' })

  // ── GET: list queue ──────────────────────────────────────────────────────
  if (req.method === 'GET') {
    // Recalculate on every fetch so positions are always consistent,
    // even if requests were inserted or modified outside of the approval flow.
    await recalculateQueuePositions()

    const { status: statusF, priority: priorityF, search, page, limit } = req.query

    const pageNum  = Math.max(1, parseInt(page as string) || 1)
    const pageSize = Math.min(100, parseInt(limit as string) || 20)
    const offset   = (pageNum - 1) * pageSize

    const conditions: string[] = []

    // Exclude completed requests — they have no business in the approval queue.
    conditions.push(`r."status" != 'COMPLETED'`)

    if (role === 'BREEDER') {
      conditions.push(`r."submittedById" = ${userId}`)
    }

    if (role === 'BIOTECHNOLOGIST') {
      conditions.push(`r."approvalStatus" IN ('APPROVED', 'PARTIALLY_APPROVED')`)
    } else if (statusF && statusF !== 'ALL') {
      conditions.push(`r."approvalStatus" = '${(statusF as string).replace(/'/g, "''")}'`)
    }

    if (priorityF && priorityF !== 'ALL') {
      conditions.push(`r."approvalPriority" = '${(priorityF as string).replace(/'/g, "''")}'`)
    }

    if (search) {
      const s = (search as string).replace(/'/g, "''")
      conditions.push(`(r."requestCode" ILIKE '%${s}%' OR r."projectCode" ILIKE '%${s}%' OR r."sampleName" ILIKE '%${s}%')`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const requests = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT
        r.id, r."requestCode", r."projectCode", r."sampleName", r.crop,
        r."testType", r."analysisToBeDone",
        r."approvalStatus", r."approvalPriority",
        r."approvalDate", r."queuePosition",
        r."predictedSamples",
        r."actualSamples",
        r."approvedSamples", r."rejectedSamples", r."rejectionReason",
        r."submittedAt",
        sb.name AS "submittedByName", sb.email AS "submittedByEmail",
        ab.name AS "approvedByName"
      FROM "Request" r
      LEFT JOIN "User" sb ON sb.id = r."submittedById"
      LEFT JOIN "User" ab ON ab.id = r."approvedById"
      ${whereClause}
      ORDER BY
        CASE WHEN r."queuePosition" IS NULL THEN 999999 ELSE r."queuePosition" END ASC,
        r."submittedAt" ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `)

    const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) AS count FROM "Request" r ${whereClause}`
    )
    const total = Number(countResult[0]?.count ?? 0)

    const shaped = requests.map(r => {
      // FIX: Do NOT fall back to predictedSamples here.
      // actualSamples is only populated when the breeder explicitly enters it
      // on the Internal Request page. Until then it must remain null so the
      // Approvals page shows "Not Entered" rather than a misleading predicted value.
      const actualSamples = (r.actualSamples as number | null) ?? null

      return {
        id:               r.id,
        requestCode:      r.requestCode,
        projectCode:      r.projectCode,
        sampleName:       r.sampleName,
        crop:             r.crop,
        testType:         r.testType,
        analysisToBeDone: r.analysisToBeDone,
        // actualSamples is the true DB value — null means not yet entered
        actualSamples,
        // predictedSamples kept separately for reference display only
        predictedSamples: (r.predictedSamples as number | null) ?? null,
        approvedSamples:  (r.approvedSamples as number) ?? 0,
        rejectedSamples:  (r.rejectedSamples as number) ?? 0,
        rejectionReason:  r.rejectionReason,
        submittedAt:      r.submittedAt,
        submittedBy: { name: r.submittedByName, email: r.submittedByEmail },
        assignedLab:  null,
        approvalQueue: {
          approvalStatus:   r.approvalStatus,
          approvalPriority: r.approvalPriority,
          approvalDate:     r.approvalDate,
          queuePosition:    r.queuePosition,
          approvedSamples:  (r.approvedSamples as number) ?? 0,
          rejectedSamples:  (r.rejectedSamples as number) ?? 0,
          rejectionReason:  r.rejectionReason,
          approvedBy:       r.approvedByName ? { name: r.approvedByName } : null,
        },
      }
    })

    return res.status(200).json({ requests: shaped, total, page: pageNum, pageSize })
  }

  // ── POST: bulk approve / reject ──────────────────────────────────────────
  if (req.method === 'POST') {
    if (role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' })

    const { action, requestIds } = req.body as {
      action: 'bulk_approve' | 'bulk_reject'
      requestIds: number[]
    }

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({ error: 'requestIds must be a non-empty array' })
    }
    if (requestIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 requests per bulk action' })
    }

    const idList = requestIds.join(',')

    const requests = await prisma.$queryRawUnsafe<Array<{
      id: number; requestCode: string; projectCode: string | null
      submittedById: number
      actualSamples: number | null; totalSamples: number | null; predictedSamples: number | null
      approvedSamples: number; rejectedSamples: number
    }>>(`
      SELECT id, "requestCode", "projectCode", "submittedById",
             "actualSamples", "totalSamples", "predictedSamples",
             "approvedSamples", "rejectedSamples"
      FROM "Request"
      WHERE id IN (${idList})
        AND "approvalStatus" IN ('PENDING_APPROVAL', 'PARTIALLY_APPROVED', 'PARTIALLY_REJECTED')
        AND "status" != 'COMPLETED'
    `)

    const now = new Date().toISOString()

    if (action === 'bulk_approve') {
      for (const r of requests) {
        const total     = r.actualSamples ?? r.totalSamples ?? r.predictedSamples ?? 0
        const remaining = total - r.approvedSamples - r.rejectedSamples
        const newApproved = r.approvedSamples + Math.max(0, remaining)
        await prisma.$executeRaw`
          UPDATE "Request" SET
            "approvalStatus"  = 'APPROVED',
            "approvedSamples" = ${newApproved},
            "approvalDate"    = ${now}::timestamp,
            "approvedById"    = ${userId},
            "queuePosition"   = NULL,
            "currentPhase"    = 'SUBMITTED',
            "status"          = 'PENDING'
          WHERE id = ${r.id}
        `
        if (global.io) {
          global.io.to(`user_${r.submittedById}`).emit('notification', {
            type: 'success',
            message: `Your request '${r.projectCode ?? r.requestCode}' has been approved.`,
          })
        }
      }
    } else if (action === 'bulk_reject') {
      for (const r of requests) {
        const total     = r.actualSamples ?? r.totalSamples ?? r.predictedSamples ?? 0
        const remaining = total - r.approvedSamples - r.rejectedSamples
        const newRejected = r.rejectedSamples + Math.max(0, remaining)
        await prisma.$executeRaw`
          UPDATE "Request" SET
            "approvalStatus"  = 'REJECTED',
            "rejectedSamples" = ${newRejected},
            "approvalDate"    = ${now}::timestamp,
            "approvedById"    = ${userId},
            "queuePosition"   = NULL,
            "status"          = 'CANCELLED'
          WHERE id = ${r.id}
        `
        if (global.io) {
          global.io.to(`user_${r.submittedById}`).emit('notification', {
            type: 'warning',
            message: `Your request '${r.projectCode ?? r.requestCode}' was not approved.`,
          })
        }
      }
    } else {
      return res.status(400).json({ error: 'Unknown bulk action' })
    }

    await writeAudit({
      action:        action === 'bulk_approve' ? 'BULK_APPROVAL' : 'BULK_REJECTION',
      entityType:    'Request',
      entityId:      0,
      detail:        `Bulk ${action === 'bulk_approve' ? 'approved' : 'rejected'} ${requests.length} request(s)`,
      performedById: userId,
    })

    await recalculateQueuePositions()
    return res.status(200).json({ ok: true, affected: requests.length })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}