// pages/api/requests/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { writeAudit } from '../../../lib/audit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Not authenticated' })

  const requestId = parseInt(req.query.id as string)
  if (isNaN(requestId)) return res.status(400).json({ error: 'Invalid request ID' })

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        submittedBy:  { select: { name: true, email: true } },
        assignedLab:  { select: { name: true } },
        phaseHistory: { orderBy: { startedAt: 'asc' } },
        reagentLogs:  {
          orderBy: { usedAt: 'desc' },
          include: {
            item:   { select: { name: true, unit: true } },
            usedBy: { select: { name: true } },
          },
        },
      },
    })

    if (!request) return res.status(404).json({ error: 'Request not found' })
    return res.status(200).json(request)
  }

  // ── PATCH ─────────────────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const user = session.user as { id: string; role: string }
    const {
      analysisToBeDone, markerType, tentativeSamplingDate,
      priority, expectedByDate, notes,
      actualSamples, actualDataPoints,
      dateOfSampling, dateOfDispatch,
      snpCount, ssrCount,
    } = req.body

    const updated = await prisma.request.update({
      where: { id: requestId },
      data: {
        analysisToBeDone:      analysisToBeDone      || null,
        markerType:            markerType            || null,
        tentativeSamplingDate: tentativeSamplingDate  ? new Date(tentativeSamplingDate) : null,
        priority:              priority               ? parseInt(priority)               : undefined,
        expectedByDate:        expectedByDate         ? new Date(expectedByDate)         : undefined,
        notes:                 notes                 || null,
        actualSamples:         actualSamples          ? parseInt(actualSamples)          : null,
        actualDataPoints:      actualDataPoints       ? parseInt(actualDataPoints)       : null,
        dateOfSampling:        dateOfSampling         ? new Date(dateOfSampling)         : null,
        dateOfDispatch:        dateOfDispatch         ? new Date(dateOfDispatch)         : null,
        snpCount:              snpCount  != null && snpCount  !== '' ? parseInt(snpCount)  : null,
        ssrCount:              ssrCount  != null && ssrCount  !== '' ? parseInt(ssrCount)  : null,
      },
    })

    await writeAudit({
      action:        'REQUEST_UPDATED',
      entityType:    'Request',
      entityId:      requestId,
      detail:        'Additional details updated',
      performedById: parseInt(user.id),
    })

    return res.status(200).json(updated)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}