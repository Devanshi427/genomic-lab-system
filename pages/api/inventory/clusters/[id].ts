// pages/api/inventory/clusters/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import { writeAudit } from '../../../../lib/audit'
import type { PrismaClient } from '@prisma/client'

type ExtendedPrismaClient = PrismaClient & {
  consumptionCluster: {
    findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
    update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
    delete: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  }
  consumptionClusterItem: {
    deleteMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  }
  consumptionDeduction: {
    deleteMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  }
}

const db = prisma as unknown as ExtendedPrismaClient

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role = (session.user as Record<string, unknown>)?.role as string
  const userId = parseInt((session.user as Record<string, unknown>)?.id as string)

  const id = parseInt(req.query.id as string)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' })

  if (req.method === 'GET') {
    const cluster = await db.consumptionCluster.findUnique({
      where: { id },
      include: {
        experiment: { select: { id: true, name: true } },
        items: {
          include: {
            item: {
              include: { lab: { select: { name: true } } }
            }
          }
        },
        deductions: {
          // FIX #2: was `performedAt` in query but schema had `deductedAt` —
          // schema is now renamed to `performedAt` so this is now correct.
          orderBy: { performedAt: 'desc' },
          take: 20,
        }
      }
    } as Record<string, unknown>)
    if (!cluster) return res.status(404).json({ error: 'Not found' })
    return res.status(200).json(cluster)
  }

  if (role !== 'INVENTORY_MANAGER' && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method === 'PUT') {
    const { name, description, unit, experimentId, items } = req.body as {
      name: string
      description?: string
      unit: string
      experimentId?: number | null
      items: Array<{ itemId: number; qtyPerUnit: number }>
    }

    // Delete old items and recreate
    await db.consumptionClusterItem.deleteMany({ where: { clusterId: id } } as Record<string, unknown>)

    const cluster = await db.consumptionCluster.update({
      where: { id },
      data: {
        name,
        description: description ?? null,
        // FIX #1: field is `unit` in schema (was basisUnit) — already aligned
        unit,
        experimentId: experimentId ?? null,
        items: {
          create: items.map((i: { itemId: number; qtyPerUnit: number }) => ({
            itemId: i.itemId,
            qtyPerUnit: i.qtyPerUnit,
          }))
        }
      },
      include: {
        experiment: { select: { id: true, name: true } },
        items: {
          include: { item: { include: { lab: { select: { name: true } } } } }
        }
      }
    } as Record<string, unknown>)

    await writeAudit({
      action: 'CLUSTER_UPDATED',
      entityType: 'ConsumptionCluster',
      entityId: id,
      detail: `Cluster "${name}" updated`,
      performedById: userId,
    })

    return res.status(200).json(cluster)
  }

  if (req.method === 'DELETE') {
    await db.consumptionClusterItem.deleteMany({ where: { clusterId: id } } as Record<string, unknown>)
    await db.consumptionDeduction.deleteMany({ where: { clusterId: id } } as Record<string, unknown>)
    await db.consumptionCluster.delete({ where: { id } } as Record<string, unknown>)

    await writeAudit({
      action: 'CLUSTER_DELETED',
      entityType: 'ConsumptionCluster',
      entityId: id,
      detail: `Cluster #${id} deleted`,
      performedById: userId,
    })

    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}