// pages/api/requests/bulk.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { writeAudit } from '../../../lib/audit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role   = (session.user as Record<string, unknown>)?.role as string
  const userId = parseInt((session.user as Record<string, unknown>)?.id as string)

  if (role !== 'BIOTECHNOLOGIST' && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { action, requestIds } = req.body

  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return res.status(400).json({ error: 'requestIds must be a non-empty array' })
  }

  if (requestIds.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 requests per bulk action' })
  }

  const ids = requestIds.map(Number).filter(n => !isNaN(n))

  if (action === 'cancel') {
    await prisma.request.updateMany({
      where: { id: { in: ids }, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      data:  { status: 'CANCELLED' },
    })

    await writeAudit({
      action:        'BULK_CANCEL',
      entityType:    'Request',
      entityId:      0,
      detail:        `Bulk cancelled ${ids.length} request(s)`,
      performedById: userId,
    })

    return res.status(200).json({ ok: true, affected: ids.length })
  }

  if (action === 'archive') {
    await prisma.request.updateMany({
      where: { id: { in: ids }, status: 'COMPLETED' },
      data:  { archived: true, archivedAt: new Date() },
    })

    await writeAudit({
      action:        'BULK_ARCHIVE',
      entityType:    'Request',
      entityId:      0,
      detail:        `Bulk archived ${ids.length} request(s)`,
      performedById: userId,
    })

    return res.status(200).json({ ok: true, affected: ids.length })
  }

  return res.status(400).json({ error: 'Unknown action' })
}