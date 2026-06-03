// pages/api/requests/index.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { writeAudit } from '../../../lib/audit'

declare const global: { io?: { to: (room: string) => { emit: (event: string, data: unknown) => void } } }


const APPROVAL_PRIORITY_TO_NUMERIC: Record<string, number> = {
  HIGH:   3,
  NORMAL: 2,
  LOW:    1,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const user = session.user as { id: string; role: string }

  // ── GET ──────────────────────────────────────────────────────────────────────

  if (req.method === 'GET') {

    if (req.query.distinct === 'years') {
      const years = await prisma.request.findMany({
        select:   { year: true },
        distinct: ['year'],
        where:    { year: { not: null } },
        orderBy:  { year: 'asc' },
      })
      return res.status(200).json(years.map(r => r.year))
    }

    const { status, from, to, archived, page, limit } = req.query

    const pageNum  = Math.max(1, parseInt(page as string) || 1)
    const pageSize = Math.min(500, parseInt(limit as string) || 10)
    const skip     = (pageNum - 1) * pageSize
    const showArchived = archived === 'true'

    const where: Record<string, unknown> = { archived: showArchived }

    try {
      const colCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'Request' AND column_name = 'approvalStatus'
      `
      if (colCheck.length > 0) {
        if (user.role === 'BREEDER') {
          // Breeders see all their own requests (pending, approved, rejected)
          where.submittedById = parseInt(user.id)
        } else if (user.role === 'BIOTECHNOLOGIST') {
          // FIX: BIOTECHNOLOGIST previously only saw APPROVED requests, making
          // PARTIALLY_APPROVED requests invisible in the requests list even though
          // phase.ts allows advancing them. They now see both APPROVED and
          // PARTIALLY_APPROVED so partially-approved requests are not stuck.
          where.approvalStatus = { in: ['APPROVED', 'PARTIALLY_APPROVED'] }
        } else {
          // ADMIN, MANAGEMENT: see all approved (including partial)
          where.approvalStatus = { in: ['APPROVED', 'PARTIALLY_APPROVED'] }
        }
      }
    } catch {
      // approvalStatus column does not exist — legacy mode, no filter applied
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      const phaseValues = ['SUBMITTED', 'RECEIVED', 'DNA_ISOLATION', 'GENOTYPING', 'ANALYSIS', 'COMPLETED']
      if (phaseValues.includes(status)) {
        where.currentPhase = status
      } else {
        where.status = status
      }
    }

    if (from || to) {
      where.submittedAt = {}
      if (from) (where.submittedAt as Record<string, unknown>).gte = new Date(from as string)
      if (to)   (where.submittedAt as Record<string, unknown>).lte = new Date(to as string)
    }

    if (req.query.year && req.query.year !== 'ALL') {
      where.year = parseInt(req.query.year as string)
    }
    if (req.query.season && req.query.season !== 'ALL') {
      where.season = req.query.season as string
    }
    if (req.query.crop && req.query.crop !== 'ALL') {
      where.crop = req.query.crop as string
    }
    if (req.query.projectCode) {
      where.projectCode = { contains: req.query.projectCode as string, mode: 'insensitive' }
    }
    if (req.query.analysis && req.query.analysis !== 'ALL') {
      where.analysisToBeDone = req.query.analysis as string
    }
    if (req.query.markerType && req.query.markerType !== 'ALL') {
      where.markerType = { equals: req.query.markerType as string, mode: 'insensitive' }
    }

    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { submittedAt: 'desc' },
        include: {
          submittedBy: { select: { name: true, email: true } },
          assignedLab: { select: { name: true } },
        },
      }),
      prisma.request.count({ where }),
    ])

    return res.status(200).json({ requests, total, page: pageNum, pageSize })
  }

  // ── POST ─────────────────────────────────────────────────────────────────────

  if (req.method === 'POST') {
    if (user.role !== 'BREEDER' && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only breeders can submit requests' })
    }

    try {
      const {
        sampleName, crop, season, year, program, purpose,
        materialStage, project, projectCode, testType,
        analysisToBeDone, traitGene, markersPerSample,
        markerType, snpCount, ssrCount, predictedSamples,
        predictedDataPoints, tentativeSamplingDate,
        approvalPriority, notes, expectedByDate,
      } = req.body

      if (!sampleName || !testType) {
        return res.status(400).json({ error: 'sampleName and testType are required' })
      }

      // Check whether approval columns exist
      const colCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'Request' AND column_name = 'approvalStatus'
      `
      const approvalColumnsExist = colCheck.length > 0

      const ts         = Date.now().toString().slice(-8)
      const rand       = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      const uniqueCode = `REQ-${ts}-${rand}`

      const numPredicted  = predictedSamples    ? parseInt(String(predictedSamples))    : null
      const numDataPoints = predictedDataPoints ? parseInt(String(predictedDataPoints)) : null
      const numMarkers    = markersPerSample    ? parseInt(String(markersPerSample))    : null
      const numSnp        = snpCount            ? parseInt(String(snpCount))            : null
      const numSsr        = ssrCount            ? parseInt(String(ssrCount))            : null
      const numYear       = year                ? parseInt(String(year))                : null

      const safeSample     = String(sampleName       || '')
      const safeCrop       = String(crop        || '') || null
      const safeSeason     = String(season      || '') || null
      const safeProgram    = String(program     || '') || null
      const safePurpose    = String(purpose     || '') || null
      const safeMaterial   = String(materialStage || '') || null
      const safeProject    = String(project     || '') || null
      const safeProjCode   = String(projectCode || '') || null
      const safeTestType   = String(testType    || '15-DAY')
      const safeAnalysis   = String(analysisToBeDone || '') || null
      const safeTrait      = String(traitGene   || '') || null
      const safeMarkerType = String(markerType  || '') || null
      const safeNotes      = String(notes       || '') || null

      const samplingDate = tentativeSamplingDate
        ? new Date(String(tentativeSamplingDate)) : null
      const expectedDate = expectedByDate
        ? new Date(String(expectedByDate))
        : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
      const submittedAt  = new Date()

      let newReqId: number | undefined

      if (approvalColumnsExist) {
        // ── Approval queue path ───────────────────────────────────────────────
        const resolvedApprovalPriority =
          ['HIGH', 'NORMAL', 'LOW'].includes(String(approvalPriority))
            ? String(approvalPriority) : 'NORMAL'

        const numericPriority = APPROVAL_PRIORITY_TO_NUMERIC[resolvedApprovalPriority] ?? 2

        // Queue position calculation
        const PRIORITY_RANK: Record<string, number> = { HIGH: 0, NORMAL: 1, LOW: 2 }
        const newRank = PRIORITY_RANK[resolvedApprovalPriority] ?? 1
        const higherKeys = Object.entries(PRIORITY_RANK)
          .filter(([, rank]) => rank < newRank).map(([p]) => p)

        let higherCount = 0
        if (higherKeys.length > 0) {
          const inList = higherKeys.map(p => `'${p}'`).join(',')
          const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
            `SELECT COUNT(*)::bigint AS cnt FROM "Request"
             WHERE "approvalStatus" IN ('PENDING_APPROVAL','PARTIALLY_APPROVED','PARTIALLY_REJECTED')
               AND "approvalPriority" IN (${inList})`
          )
          higherCount = Number(rows[0]?.cnt ?? 0)
        }

        const sameRows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
          `SELECT COUNT(*)::bigint AS cnt FROM "Request"
           WHERE "approvalStatus" IN ('PENDING_APPROVAL','PARTIALLY_APPROVED','PARTIALLY_REJECTED')
             AND "approvalPriority" = $1`,
          resolvedApprovalPriority
        )
        const sameCount = Number(sameRows[0]?.cnt ?? 0)
        const initialQueuePosition = higherCount + sameCount + 1

        const insertResult = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
          `INSERT INTO "Request" (
            "requestCode","submittedById","sampleName","crop","season","year",
            "program","purpose","materialStage","project","projectCode",
            "testType","analysisToBeDone","traitGene","markersPerSample",
            "markerType","snpCount","ssrCount","predictedSamples","predictedDataPoints",
            "tentativeSamplingDate","notes","expectedByDate",
            "approvalStatus","approvalPriority","totalSamples",
            "approvedSamples","rejectedSamples","queuePosition",
            "currentPhase","status","priority","submittedAt","archived"
          ) VALUES (
            $1,$2,$3,$4,$5,$6,
            $7,$8,$9,$10,$11,
            $12,$13,$14,$15,
            $16,$17,$18,$19,$20,
            $21,$22,$23,
            'PENDING_APPROVAL',$24,$25,
            0,0,$26,
            'SUBMITTED','PENDING',$27,$28,false
          ) RETURNING id`,
          uniqueCode, parseInt(user.id), safeSample, safeCrop, safeSeason, numYear,
          safeProgram, safePurpose, safeMaterial, safeProject, safeProjCode,
          safeTestType, safeAnalysis, safeTrait, numMarkers,
          safeMarkerType, numSnp, numSsr, numPredicted, numDataPoints,
          samplingDate, safeNotes, expectedDate,
          resolvedApprovalPriority, numPredicted,
          initialQueuePosition,
          numericPriority,
          submittedAt
        )

        newReqId = insertResult[0]?.id

        if (newReqId) {
          await prisma.phaseHistory.create({
            data: { phase: 'SUBMITTED', requestId: newReqId },
          })
          await writeAudit({
            action: 'REQUEST_CREATED', entityType: 'Request', entityId: newReqId,
            detail: `${safeProjCode ?? safeSample} — queued for approval (${resolvedApprovalPriority})`.trim(),
            performedById: parseInt(user.id),
          })
          if (global.io) {
            global.io.to('ADMIN').emit('notification', {
              type: 'info',
              message: `New request in approval queue: ${safeProjCode ?? safeSample} (${resolvedApprovalPriority} priority)`,
            })
          }
        }

        return res.status(201).json({
          id:               newReqId,
          requestCode:      uniqueCode,
          approvalStatus:   'PENDING_APPROVAL',
          approvalPriority: resolvedApprovalPriority,
          queuePosition:    initialQueuePosition,
          message:          'Request submitted successfully. Awaiting approval before lab processing.',
        })

      } else {
        // ── Legacy path (migration not yet run) ───────────────────────────────
        const request = await prisma.request.create({
          data: {
            requestCode: uniqueCode, submittedById: parseInt(user.id),
            sampleName: safeSample, crop: safeCrop, season: safeSeason,
            year: numYear, program: safeProgram, purpose: safePurpose,
            materialStage: safeMaterial, project: safeProject,
            projectCode: safeProjCode, testType: safeTestType,
            analysisToBeDone: safeAnalysis, traitGene: safeTrait,
            markersPerSample: numMarkers, markerType: safeMarkerType,
            snpCount: numSnp, ssrCount: numSsr, predictedSamples: numPredicted,
            predictedDataPoints: numDataPoints, tentativeSamplingDate: samplingDate,
            notes: safeNotes, expectedByDate: expectedDate,
            priority: 1, status: 'PENDING', currentPhase: 'SUBMITTED',
            phaseHistory: { create: { phase: 'SUBMITTED' } },
          },
          include: {
            submittedBy: { select: { name: true, email: true } },
            assignedLab: { select: { name: true } },
          },
        })
        newReqId = request.id
        await writeAudit({
          action: 'REQUEST_CREATED', entityType: 'Request', entityId: request.id,
          detail: `${request.projectCode ?? request.sampleName}`.trim(),
          performedById: parseInt(user.id),
        })
        if (global.io) {
          global.io.to('BIOTECHNOLOGIST').emit('notification', {
            type: 'info',
            message: `New request submitted: ${request.projectCode ?? request.sampleName}`,
          })
        }
        return res.status(201).json(request)
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[POST /api/requests] ERROR:', message)
      return res.status(500).json({ error: 'Failed to create request', detail: message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}