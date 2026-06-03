import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import bcrypt from 'bcryptjs'
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()
 
  if (req.method !== 'POST') return res.status(405).end()
 
  const user = session.user as { id: string }
  const { currentPassword, newPassword } = req.body
 
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both fields are required' })
  }
 
  if (newPassword.length < 8) {
    return res.status(400).json({
      error: 'New password must be at least 8 characters'
    })
  }
 
  const dbUser = await prisma.user.findUnique({
    where: { id: parseInt(user.id) },
    select: { password: true }
  })
 
  if (!dbUser) return res.status(404).json({ error: 'User not found' })
 
  const valid = await bcrypt.compare(currentPassword, dbUser.password)
  if (!valid) {
    return res.status(400).json({ error: 'Current password is incorrect' })
  }
 
  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: parseInt(user.id) },
    data: { password: hashed }
  })
 
  return res.status(200).json({ message: 'Password updated successfully' })
}
