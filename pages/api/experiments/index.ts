import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const experiments = await prisma.experiment.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  })
  return res.status(200).json(experiments)
}