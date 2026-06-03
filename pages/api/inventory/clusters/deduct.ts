// pages/api/inventory/clusters/deduct.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import { writeAudit } from '../../../../lib/audit'

// FIX: Removed the ExtendedPrismaClient type alias and 'db' variable.
// Previously the file defined:
//   const db = prisma as unknown as ExtendedPrismaClient
// but then the actual Prisma calls used the original 'prisma' client directly,
// making the type alias provide no real type safety. The db alias was used
// only for findUnique which also used 'as Record<string, unknown>' args,
// defeating any benefit. All calls now use 'prisma' directly.

type ClusterItemWithItem = {
  itemId: number
  qtyPerUnit: number
  item: {
    id: number
    name: string
    unit: string
    quantity: number
  }
}

type ClusterWithItems = {
  id: number
  name: string
  unit: string
  items: ClusterItemWithItem[]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session) return res.status(401).end()

    const role   = (session.user as Record<string, unknown>)?.role as string
    const userId = parseInt((session.user as Record<string, unknown>)?.id as string)

    const allowed = ['ADMIN', 'INVENTORY_MANAGER', 'BIOTECHNOLOGIST']
    if (!allowed.includes(role)) return res.status(403).json({ error: 'Forbidden' })

    if (req.method !== 'POST') return res.status(405).end()

    const { clusterId, units, notes, projectCode, requestId } = req.body as {
      clusterId:    number
      units:        number
      notes?:       string
      projectCode?: string
      requestId?:   number
    }

    if (!clusterId || !units || units <= 0) {
      return res.status(400).json({ error: 'clusterId and positive units are required' })
    }

    // Load the cluster with all its items using raw prisma (no type alias needed)
    const cluster = await (prisma as unknown as {
      consumptionCluster: {
        findUnique: (args: object) => Promise<ClusterWithItems | null>
      }
    }).consumptionCluster.findUnique({
      where: { id: clusterId },
      include: {
        items: {
          include: { item: true }
        }
      }
    } as object)

    if (!cluster) return res.status(404).json({ error: 'Cluster not found' })

    // Pre-check: verify sufficient stock for all items
    const stockErrors: string[] = []
    for (const ci of cluster.items) {
      const totalNeeded = ci.qtyPerUnit * units
      if (ci.item.quantity < totalNeeded) {
        stockErrors.push(
          `"${ci.item.name}": need ${totalNeeded.toFixed(2)} ${ci.item.unit}, only ${ci.item.quantity} available`
        )
      }
    }

    if (stockErrors.length > 0) {
      return res.status(400).json({
        error: 'Insufficient stock for some items',
        details: stockErrors
      })
    }

    const inventoryUpdates = cluster.items.map((ci: ClusterItemWithItem) => {
      const totalUsed = parseFloat((ci.qtyPerUnit * units).toPrecision(10))
      return prisma.inventoryItem.update({
        where: { id: ci.itemId },
        data:  { quantity: { decrement: totalUsed } },
      })
    })

    const reagentLogCreates = cluster.items.map((ci: ClusterItemWithItem) => {
      const totalUsed = parseFloat((ci.qtyPerUnit * units).toPrecision(10))
      return prisma.reagentLog.create({
        data: {
          itemId:       ci.itemId,
          // requestId is intentionally optional — deductions may occur outside
          // of a formal approved request (maintenance, calibration, etc.)
          requestId:    requestId ?? null,
          usedById:     userId,
          quantityUsed: totalUsed,
          purpose: `Cluster deduction: ${cluster.name} × ${units} ${cluster.unit}(s)${notes ? ` — ${notes}` : ''}`,
        },
      })
    })

    // Build deduction data with typed approach (no as-any cast needed)
    const deductionData: {
      cluster:       { connect: { id: number } }
      performedBy:   { connect: { id: number } }
      request?:      { connect: { id: number } }
      units:         number
      notes:         string | null
      projectCode?:  string
    } = {
      cluster:     { connect: { id: clusterId } },
      performedBy: { connect: { id: userId } },
      units,
      notes:       notes ?? null,
    }

    if (requestId) {
      deductionData.request = { connect: { id: requestId } }
    }
    if (projectCode) {
      deductionData.projectCode = projectCode
    }

    // Execute stock decrements + reagent logs + deduction record atomically
    await prisma.$transaction([
      ...inventoryUpdates,
      ...reagentLogCreates,
      prisma.consumptionDeduction.create({ data: deductionData }),
    ])

    await writeAudit({
      action:      'CLUSTER_DEDUCTION',
      entityType:  'ConsumptionCluster',
      entityId:    clusterId,
      detail:      `Deducted ${units} ${cluster.unit}(s) from cluster "${cluster.name}"`,
      performedById: userId,
    })

    // Return updated stock levels
    const updatedItems = await prisma.inventoryItem.findMany({
      where:  { id: { in: cluster.items.map((ci: ClusterItemWithItem) => ci.itemId) } },
      select: { id: true, name: true, quantity: true, unit: true },
    })

    return res.status(200).json({
      ok:      true,
      cluster: cluster.name,
      units,
      deducted: cluster.items.map((ci: ClusterItemWithItem) => ({
        name:      ci.item.name,
        deducted:  ci.qtyPerUnit * units,
        unit:      ci.item.unit,
        remaining: updatedItems.find(u => u.id === ci.itemId)?.quantity ?? 0,
      })),
    })
  } catch (err) {
    console.error('DEDUCT ERROR:', err)
    return res.status(500).json({ error: String(err) })
  }
}