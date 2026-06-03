// pages/api/approvals/capacity.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { writeAudit } from '../../../lib/audit'

const SERVICE_TYPES = ['DNA_ISOLATION', 'GENOTYPING'] as const
type ServiceType = typeof SERVICE_TYPES[number]

const DEFAULT_CAPACITIES: Record<ServiceType, number> = {
  DNA_ISOLATION: 15000,
  GENOTYPING:    10000,
}

// Both capacities are measured in SAMPLES — the number of physical samples
// the lab can process in a week. DNA_ISOLATION takes one sample through
// extraction; GENOTYPING takes one extracted sample through marker analysis.
// FIX: the API previously labelled genotyping as "data points" (samples × markers)
// while the modal label said "samples". Both are now "samples" throughout.

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

async function ensureCurrentWeekCapacity(weekStart: Date) {
  const ws = weekStart.toISOString()
  for (const serviceType of SERVICE_TYPES) {
    const existing = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "CapacityTracking"
      WHERE "weekStart" = ${ws}::timestamp AND "serviceType" = ${serviceType}
      LIMIT 1
    `
    if (!existing || existing.length === 0) {
      const prev = await prisma.$queryRaw<Array<{ capacity: number }>>`
        SELECT capacity FROM "CapacityTracking"
        WHERE "serviceType" = ${serviceType}
        ORDER BY "weekStart" DESC
        LIMIT 1
      `
      const capacity = prev?.[0]?.capacity ?? DEFAULT_CAPACITIES[serviceType as ServiceType]
      await prisma.$executeRaw`
        INSERT INTO "CapacityTracking" ("weekStart", "serviceType", "capacity", "createdAt", "updatedAt")
        VALUES (${ws}::timestamp, ${serviceType}, ${capacity}, NOW(), NOW())
        ON CONFLICT ("weekStart", "serviceType") DO NOTHING
      `
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role   = (session.user as Record<string, unknown>)?.role as string
  const userId = parseInt((session.user as Record<string, unknown>)?.id as string)

  const allowed = ['ADMIN', 'MANAGEMENT', 'BREEDER', 'BIOTECHNOLOGIST']
  if (!allowed.includes(role)) return res.status(403).json({ error: 'Forbidden' })

  const now       = new Date()
  const weekStart = getWeekStart(now)
  const weekEnd   = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    await ensureCurrentWeekCapacity(weekStart)

    const capacityRows = await prisma.$queryRaw<Array<{
      serviceType: string; capacity: number
    }>>`
      SELECT "serviceType", "capacity"
      FROM "CapacityTracking"
      WHERE "weekStart" = ${weekStart.toISOString()}::timestamp
    `

    // DNA_ISOLATION: count approved samples this week
    const dnaRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COALESCE(SUM("approvedSamples"), 0)::bigint AS total
      FROM "Request"
      WHERE "approvalStatus" IN ('APPROVED', 'PARTIALLY_APPROVED')
        AND "approvalDate" >= ${weekStart.toISOString()}::timestamp
        AND "approvalDate" <  ${weekEnd.toISOString()}::timestamp
    `
    const dnaApprovedThisWeek = Number(dnaRows[0]?.total ?? 0)

    // GENOTYPING: count approved samples this week (same unit as DNA_ISOLATION).
    // FIX: was computing samples × markersPerSample ("data points") which is a
    // different magnitude. Capacity is now set and consumed in samples for both
    // service types, making the admin's capacity entry unambiguous.
    const genoRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COALESCE(SUM("approvedSamples"), 0)::bigint AS total
      FROM "Request"
      WHERE "approvalStatus" IN ('APPROVED', 'PARTIALLY_APPROVED')
        AND "approvalDate" >= ${weekStart.toISOString()}::timestamp
        AND "approvalDate" <  ${weekEnd.toISOString()}::timestamp
    `
    const genoApprovedThisWeek = Number(genoRows[0]?.total ?? 0)

    // Pending queue stats
    const pendingRows = await prisma.$queryRaw<Array<{
      cnt: bigint; samplesSum: bigint; dataPointsSum: bigint
    }>>`
      SELECT
        COUNT(*)::bigint AS cnt,
        COALESCE(SUM(COALESCE("totalSamples", "predictedSamples", 0)), 0)::bigint AS "samplesSum",
        COALESCE(SUM(
          COALESCE("totalSamples", "predictedSamples", 0)
          * COALESCE("markersPerSample", 1)
        ), 0)::bigint AS "dataPointsSum"
      FROM "Request"
      WHERE "approvalStatus" IN ('PENDING_APPROVAL', 'PARTIALLY_APPROVED', 'PARTIALLY_REJECTED')
    `
    const pendingRequests   = Number(pendingRows[0]?.cnt ?? 0)
    const pendingSamples    = Number(pendingRows[0]?.samplesSum ?? 0)
    const pendingDataPoints = Number(pendingRows[0]?.dataPointsSum ?? 0)

    const capacityMap: Record<string, number> = {}
    capacityRows.forEach(row => { capacityMap[row.serviceType] = row.capacity })

    const dnaCap  = capacityMap['DNA_ISOLATION'] ?? DEFAULT_CAPACITIES.DNA_ISOLATION
    const genoCap = capacityMap['GENOTYPING']    ?? DEFAULT_CAPACITIES.GENOTYPING

    return res.status(200).json({
      weekStart: weekStart.toISOString(),
      weekEnd:   weekEnd.toISOString(),
      dnaIsolation: {
        serviceType:       'DNA_ISOLATION',
        unit:              'samples',
        weeklyCapacity:    dnaCap,
        approvedThisWeek:  dnaApprovedThisWeek,
        remainingCapacity: Math.max(0, dnaCap - dnaApprovedThisWeek),
      },
      genotyping: {
        serviceType:       'GENOTYPING',
        unit:              'samples',          // FIX: was 'data points'
        weeklyCapacity:    genoCap,
        approvedThisWeek:  genoApprovedThisWeek,
        remainingCapacity: Math.max(0, genoCap - genoApprovedThisWeek),
      },
      queue: { pendingRequests, pendingSamples, pendingDataPoints },
    })
  }

  // ── PATCH: update capacity ────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    if (role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' })

    const { serviceType, capacity } = req.body as {
      serviceType: string; capacity: number
    }

    if (!SERVICE_TYPES.includes(serviceType as ServiceType)) {
      return res.status(400).json({ error: 'serviceType must be DNA_ISOLATION or GENOTYPING' })
    }
    if (!capacity || capacity <= 0) {
      return res.status(400).json({ error: 'capacity must be a positive number' })
    }

    await ensureCurrentWeekCapacity(weekStart)
    const ws = weekStart.toISOString()

    await prisma.$executeRaw`
      UPDATE "CapacityTracking"
      SET "capacity" = ${capacity}, "updatedAt" = NOW()
      WHERE "weekStart" = ${ws}::timestamp AND "serviceType" = ${serviceType}
    `

    await writeAudit({
      action: 'CAPACITY_CHANGED', entityType: 'CapacityTracking', entityId: 0,
      detail: `${serviceType} capacity set to ${capacity} samples/week`,
      performedById: userId,
    })

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}