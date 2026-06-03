// pages/api/dashboard/crops.ts
//
// Returns the distinct non-null values of the `crop` field from Request.
// Used to populate the Crop filter dropdown on the dashboard.

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'MANAGEMENT' && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // `crop` is String? on Request — fetch distinct non-null values
    const rows = await prisma.request.findMany({
      where:    { crop: { not: null }, archived: false },
      select:   { crop: true },
      distinct: ['crop'],
      orderBy:  { crop: 'asc' },
    })

    const crops = rows
      .map((r: { crop: string | null }) => r.crop)
      .filter((c): c is string => c !== null)

    return res.status(200).json({ crops })
  } catch (err) {
    console.error('[dashboard/crops]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}