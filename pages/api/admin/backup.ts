// pages/api/admin/backup.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { createBackup, listBackups, restoreBackup } from '../../../lib/backup'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()
  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    // List all backups
    const backups = listBackups().map(b => ({
      filename: b.filename,
      sizeKb: parseFloat((b.sizeBytes / 1024).toFixed(1)),
      createdAt: b.createdAt.toISOString(),
    }))
    return res.status(200).json(backups)
  }

  if (req.method === 'POST') {
    const { action, filename } = req.body

    if (action === 'create') {
      try {
        const result = await createBackup()
        return res.status(200).json({
          filename: result.filename,
          sizeKb: parseFloat((result.sizeBytes / 1024).toFixed(1)),
          createdAt: result.createdAt.toISOString(),
        })
      } catch (err) {
        return res.status(500).json({ error: String(err) })
      }
    }

    if (action === 'restore') {
      if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ error: 'filename required' })
      }
      // Sanitise: only allow simple filenames with no path traversal
      if (!/^genomiclab-backup-[\w\-]+\.sql\.gz$/.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename' })
      }
      try {
        await restoreBackup(filename)
        return res.status(200).json({ ok: true })
      } catch (err) {
        return res.status(500).json({ error: String(err) })
      }
    }

    return res.status(400).json({ error: 'Unknown action' })
  }

  return res.status(405).end()
}
