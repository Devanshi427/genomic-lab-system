// pages/api/approvals/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { writeAudit } from '../../../lib/audit'

declare const global: { io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } } }

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, NORMAL: 1, LOW: 2 }

const INITIAL_PHASES = new Set(['SUBMITTED'])

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

  const id = parseInt(req.query.id as string)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' })

  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })
  if (role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' })

  const { action, samples, reason, priority } = req.body as {
    action:    'approve' | 'reject' | 'partial_approve' | 'partial_reject' | 'change_priority'
    samples?:  number
    reason?:   string
    priority?: string
  }

  // FIX 3: "actualSamples" was missing from this SELECT entirely.
  // Without it, totalSamples falls back to predictedSamples and all approval
  // math (remaining, newApproved, newRejected) operates on the wrong number.
  const rows = await prisma.$queryRaw<Array<{
    id: number; requestCode: string; projectCode: string | null
    approvalStatus: string; approvalPriority: string; currentPhase: string
    actualSamples: number | null
    totalSamples: number | null; predictedSamples: number | null
    approvedSamples: number; rejectedSamples: number
    rejectionReason: string | null; submittedById: number
  }>>`
    SELECT id, "requestCode", "projectCode", "approvalStatus", "approvalPriority",
           "currentPhase",
           "actualSamples",
           "totalSamples", "predictedSamples",
           "approvedSamples", "rejectedSamples",
           "rejectionReason", "submittedById"
    FROM "Request" WHERE id = ${id} LIMIT 1
  `

  if (!rows || rows.length === 0) return res.status(404).json({ error: 'Request not found' })
  const existing = rows[0]

  // FIX 3: Use actualSamples as the canonical count. totalSamples and
  // predictedSamples are only fallbacks for legacy/draft records that
  // pre-date the actualSamples field being populated.
  const totalSamples    = existing.actualSamples ?? existing.totalSamples ?? existing.predictedSamples ?? 0
  const alreadyApproved = existing.approvedSamples
  const alreadyRejected = existing.rejectedSamples
  const remaining       = totalSamples - alreadyApproved - alreadyRejected
  const now             = new Date().toISOString()
  const code            = existing.projectCode ?? existing.requestCode

  const shouldResetPhase = INITIAL_PHASES.has(existing.currentPhase)
  const phaseOnApprove   = shouldResetPhase ? 'SUBMITTED' : existing.currentPhase

  // ── Change Priority ────────────────────────────────────────────────────
  if (action === 'change_priority') {
    if (!priority || !['HIGH', 'NORMAL', 'LOW'].includes(priority)) {
      return res.status(400).json({ error: 'Valid priority required: HIGH, NORMAL, LOW' })
    }
    // FIX 2: Write to BOTH priority columns so the Requests page and the
    // Approvals page always show the same value. Previously only
    // "approvalPriority" was updated, leaving "priority" stale.
    await prisma.$executeRaw`
      UPDATE "Request"
      SET "approvalPriority" = ${priority},
          "priority"         = ${priority}
      WHERE id = ${id}
    `
    await writeAudit({
      action: 'PRIORITY_CHANGED', entityType: 'Request', entityId: id,
      detail: `Priority changed to ${priority} for '${code}'`, performedById: userId,
    })
    await recalculateQueuePositions()
    return res.status(200).json({ ok: true })
  }

  // ── Full Approve ───────────────────────────────────────────────────────
  if (action === 'approve') {
    if (existing.approvalStatus === 'APPROVED') {
      return res.status(400).json({ error: 'Already fully approved' })
    }
    const newApproved = alreadyApproved + remaining
    await prisma.$executeRaw`
      UPDATE "Request" SET
        "approvalStatus"  = 'APPROVED',
        "approvedSamples" = ${newApproved},
        "approvalDate"    = ${now}::timestamp,
        "approvedById"    = ${userId},
        "queuePosition"   = NULL,
        "currentPhase"    = ${phaseOnApprove},
        "status"          = 'PENDING'
      WHERE id = ${id}
    `
    await writeAudit({
      action: 'REQUEST_APPROVED', entityType: 'Request', entityId: id,
      detail: `Approved all ${remaining} remaining samples for '${code}'`, performedById: userId,
    })
    if (global.io) {
      global.io.to(`user_${existing.submittedById}`).emit('notification', {
        type: 'success',
        message: `Your request '${code}' has been approved.`,
      })
    }
    await recalculateQueuePositions()
    return res.status(200).json({ ok: true })
  }

  // ── Full Reject ────────────────────────────────────────────────────────
  if (action === 'reject') {
    if (existing.approvalStatus === 'REJECTED') {
      return res.status(400).json({ error: 'Already fully rejected' })
    }
    const newRejected = alreadyRejected + remaining
    const safeReason  = reason ?? null
    await prisma.$executeRaw`
      UPDATE "Request" SET
        "approvalStatus"  = 'REJECTED',
        "rejectedSamples" = ${newRejected},
        "rejectionReason" = ${safeReason},
        "approvalDate"    = ${now}::timestamp,
        "approvedById"    = ${userId},
        "queuePosition"   = NULL,
        "status"          = 'CANCELLED'
      WHERE id = ${id}
    `
    await writeAudit({
      action: 'REQUEST_REJECTED', entityType: 'Request', entityId: id,
      detail: `Rejected '${code}'${reason ? ` — ${reason}` : ''}`, performedById: userId,
    })
    if (global.io) {
      global.io.to(`user_${existing.submittedById}`).emit('notification', {
        type: 'warning',
        message: `Your request '${code}' was not approved.`,
      })
    }
    await recalculateQueuePositions()
    return res.status(200).json({ ok: true })
  }

  // ── Partial Approve ────────────────────────────────────────────────────
  if (action === 'partial_approve') {
    if (!samples || samples <= 0) {
      return res.status(400).json({ error: 'samples must be a positive number' })
    }
    if (samples > remaining) {
      return res.status(400).json({
        error: `Cannot approve ${samples} — only ${remaining} remaining`,
      })
    }
    const newApproved     = alreadyApproved + samples
    const isFullyApproved = newApproved + alreadyRejected >= totalSamples

    if (isFullyApproved) {
      await prisma.$executeRaw`
        UPDATE "Request" SET
          "approvalStatus"  = 'APPROVED',
          "approvedSamples" = ${newApproved},
          "approvalDate"    = ${now}::timestamp,
          "approvedById"    = ${userId},
          "queuePosition"   = NULL,
          "currentPhase"    = ${phaseOnApprove},
          "status"          = 'PENDING'
        WHERE id = ${id}
      `
    } else {
      await prisma.$executeRaw`
        UPDATE "Request" SET
          "approvalStatus"  = 'PARTIALLY_APPROVED',
          "approvedSamples" = ${newApproved},
          "approvalDate"    = ${now}::timestamp,
          "approvedById"    = ${userId}
        WHERE id = ${id}
      `
    }
    await writeAudit({
      action: 'PARTIAL_APPROVAL', entityType: 'Request', entityId: id,
      detail: `Partially approved ${samples} samples for '${code}' (${newApproved}/${totalSamples} total)`,
      performedById: userId,
    })
    if (global.io) {
      global.io.to(`user_${existing.submittedById}`).emit('notification', {
        type: 'success',
        message: `${samples} samples from request '${code}' have been approved.`,
      })
    }
    await recalculateQueuePositions()
    return res.status(200).json({ ok: true })
  }

  // ── Partial Reject ─────────────────────────────────────────────────────
  if (action === 'partial_reject') {
    if (!samples || samples <= 0) {
      return res.status(400).json({ error: 'samples must be a positive number' })
    }
    if (samples > remaining) {
      return res.status(400).json({
        error: `Cannot reject ${samples} — only ${remaining} remaining`,
      })
    }
    const newRejected     = alreadyRejected + samples
    const isFullyRejected = newRejected + alreadyApproved >= totalSamples
    const safeReason      = reason ?? existing.rejectionReason

    if (isFullyRejected) {
      await prisma.$executeRaw`
        UPDATE "Request" SET
          "approvalStatus"  = 'REJECTED',
          "rejectedSamples" = ${newRejected},
          "rejectionReason" = ${safeReason},
          "approvalDate"    = ${now}::timestamp,
          "approvedById"    = ${userId},
          "queuePosition"   = NULL,
          "status"          = 'CANCELLED'
        WHERE id = ${id}
      `
    } else {
      await prisma.$executeRaw`
        UPDATE "Request" SET
          "approvalStatus"  = 'PARTIALLY_REJECTED',
          "rejectedSamples" = ${newRejected},
          "rejectionReason" = ${safeReason},
          "approvalDate"    = ${now}::timestamp,
          "approvedById"    = ${userId}
        WHERE id = ${id}
      `
    }
    await writeAudit({
      action: 'PARTIAL_REJECTION', entityType: 'Request', entityId: id,
      detail: `Partially rejected ${samples} samples for '${code}' (${newRejected}/${totalSamples} rejected)`,
      performedById: userId,
    })
    if (global.io) {
      global.io.to(`user_${existing.submittedById}`).emit('notification', {
        type: 'warning',
        message: `${samples} samples from request '${code}' were rejected.`,
      })
    }
    await recalculateQueuePositions()
    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: 'Unknown action' })
}
