import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'

function escapeCsv(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'INVENTORY_MANAGER' && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method !== 'GET') return res.status(405).end()

  const { from, to, itemId } = req.query
  const where: Record<string, unknown> = {}

  if (from || to) {
    where.usedAt = {
      ...(from ? { gte: new Date(from as string) } : {}),
      ...(to   ? { lte: new Date(to   as string) } : {}),
    }
  }
  if (itemId) {
    where.itemId = parseInt(itemId as string)
  }

  const logs = await prisma.reagentLog.findMany({
    where,
    include: {
      item:    { select: { name: true, unit: true } },
      usedBy:  { select: { name: true } },
      request: { select: { requestCode: true, sampleName: true } },
    },
    orderBy: { usedAt: 'desc' },
    take: 5000,
  })

  const headers = [
    'Date', 'Reagent', 'Quantity Used', 'Unit',
    'Purpose', 'Request Code', 'Sample Name', 'Used By'
  ]

  const csvRows = [
    headers.join(','),
    ...logs.map(log => [
      escapeCsv(new Date(log.usedAt).toLocaleDateString('en-GB')),
      escapeCsv(log.item.name),
      escapeCsv(log.quantityUsed),
      escapeCsv(log.item.unit),
      escapeCsv(log.purpose),
      escapeCsv(log.request?.requestCode ?? ''),
      escapeCsv(log.request?.sampleName ?? ''),
      escapeCsv(log.usedBy.name),
    ].join(','))
  ]

  const csv = csvRows.join('\n')
  const filename = `reagent-logs-${new Date().toISOString().slice(0, 10)}.csv`

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  return res.status(200).send(csv)
}