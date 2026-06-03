import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const id = parseInt(req.query.id as string)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid experiment ID' })

  const experimentItems = await prisma.experimentItem.findMany({
    where: { experimentId: id },
    include: {
      item: {
        include: { lab: { select: { id: true, name: true } } }
      }
    }
  })

  const result = experimentItems.map(ei => ({
    id: ei.item.id,
    name: ei.item.name,
    quantity: ei.item.quantity,
    unit: ei.item.unit,
    labs: [{ id: ei.item.lab.id, name: ei.item.lab.name }]
  }))

  return res.status(200).json(result)
}