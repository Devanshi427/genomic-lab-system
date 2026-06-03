import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()
 
  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' })
 
  const id = parseInt(req.query.id as string)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' })
 
  if (req.method === 'PATCH') {
    const { userRole } = req.body
    if (!userRole) return res.status(400).json({ error: 'userRole is required' })
 
    const updated = await prisma.user.update({
      where: { id },
      data: { role: userRole },
      select: { id: true, name: true, email: true, role: true }
    })
    return res.status(200).json(updated)
  }
 
  if (req.method === 'DELETE') {
    const me = (session.user as Record<string, unknown>)?.id
    if (parseInt(String(me)) === id) {
      return res.status(400).json({ error: 'You cannot delete your own account' })
    }
    await prisma.user.delete({ where: { id } })
    return res.status(204).end()
  }
 
  return res.status(405).json({ error: 'Method not allowed' })
}
