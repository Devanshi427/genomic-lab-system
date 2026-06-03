// lib/archival.ts
import { prisma } from './prisma'

const ARCHIVE_AFTER_DAYS = 90

export async function archiveOldRequests(): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - ARCHIVE_AFTER_DAYS)

  const result = await prisma.request.updateMany({
    where: {
      status:      'COMPLETED',
      completedAt: { lte: cutoff },
      archived:    false,
    },
    data: {
      archivedAt: new Date(),
      archived:   true,
    },
  })

  return result.count
}