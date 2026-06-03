import { prisma } from './prisma'
 
export async function writeAudit({
  action,
  entityType,
  entityId,
  detail,
  performedById,
}: {
  action: string
  entityType: string
  entityId: number
  detail?: string
  performedById: number
}) {
  try {
    await prisma.auditLog.create({
      data: { action, entityType, entityId, detail: detail ?? null, performedById }
    })
  } catch {
    // Audit failures should never crash the main operation
    console.error('[Audit] Failed to write audit log entry')
  }
}
