import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import bcrypt from 'bcryptjs'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' })

  // GET — list all users
  if (req.method === 'GET') {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true
      },
      orderBy: { name: 'asc' }
    })
    return res.status(200).json(users)
  }

  // POST — create a new user
  if (req.method === 'POST') {
    const { name, email, password, userRole } = req.body

    if (!name || !email || !password || !userRole) {
      return res.status(400).json({ error: 'All fields are required' })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(400).json({ error: 'A user with that email already exists' })
    }

    const hashed = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { name, email, password: hashed, role: userRole },
      select: { id: true, name: true, email: true, role: true }
    })

    return res.status(201).json(user)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}