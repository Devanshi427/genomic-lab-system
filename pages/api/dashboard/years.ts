// pages/api/dashboard/years.ts
//
// Returns the distinct non-null values of the `year` Int? field from Request,
// sorted descending (most recent first).
// Used to populate the Year filter dropdown on the dashboard.

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
    // `year` is Int? on Request — fetch distinct non-null values
    const rows = await prisma.request.findMany({
      where:    { year: { not: null }, archived: false },
      select:   { year: true },
      distinct: ['year'],
      orderBy:  { year: 'desc' },   // most recent first
    })

    const years = rows
      .map((r: { year: number | null }) => r.year)
      .filter((y): y is number => y !== null)

    return res.status(200).json({ years })
  } catch (err) {
    console.error('[dashboard/years]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}