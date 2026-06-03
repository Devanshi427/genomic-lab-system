// pages/api/inventory/clusters/index.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import { writeAudit } from '../../../../lib/audit'
import type { PrismaClient } from '@prisma/client'

type ExtendedPrismaClient = PrismaClient & {
  consumptionCluster: {
    findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>
    create: (args: Record<string, unknown>) => Promise<Record<string, unknown> & { id: number; name: string }>
    update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  }
}

const db = prisma as unknown as ExtendedPrismaClient

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role = (session.user as Record<string, unknown>)?.role as string
  const userId = parseInt((session.user as Record<string, unknown>)?.id as string)

  const allowed = ['ADMIN', 'INVENTORY_MANAGER', 'BIOTECHNOLOGIST']
  if (!allowed.includes(role)) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    try {
      const clusters = await db.consumptionCluster.findMany({
        include: {
          experiment: { select: { id: true, name: true } },
          items: {
            include: {
              item: {
                include: { lab: { select: { name: true } } }
              }
            }
          },
          _count: { select: { deductions: true } }
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
      } as Record<string, unknown>)
      return res.status(200).json(clusters)
    } catch (e) {
      console.error('CLUSTER GET ERROR:', e)
      return res.status(500).json({ error: String(e) })
    }
  }

  if (req.method === 'POST') {
    if (role !== 'INVENTORY_MANAGER' && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only INVENTORY_MANAGER or ADMIN can create clusters' })
    }

    const { name, description, unit, experimentId, items } = req.body as {
      name: string
      description?: string
      unit: string
      experimentId?: number
      items: Array<{ itemId: number; qtyPerUnit: number }>
    }

    if (!name || !items || items.length === 0) {
      return res.status(400).json({ error: 'name and at least one item are required' })
    }

    try {
      const cluster = await db.consumptionCluster.create({
        data: {
          name,
          description: description ?? null,
          unit: unit ?? 'sample',
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
            include: {
              item: { include: { lab: { select: { name: true } } } }
            }
          }
        }
      } as Record<string, unknown>)

      await writeAudit({
        action: 'CLUSTER_CREATED',
        entityType: 'ConsumptionCluster',
        entityId: cluster.id,
        detail: `Cluster "${cluster.name}" created with ${items.length} items`,
        performedById: userId,
      })

      return res.status(201).json(cluster)
    } catch (e) {
      console.error('CLUSTER CREATE ERROR:', e)
      return res.status(500).json({ error: String(e) })
    }
  }

  if (req.method === 'PATCH') {
    if (role !== 'INVENTORY_MANAGER' && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only INVENTORY_MANAGER or ADMIN can reorder clusters' })
    }

    const { updates } = req.body as { updates: Array<{ id: number; sortOrder: number }> }
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'updates array required' })
    }

    try {
      await Promise.all(
        updates.map(u =>
          db.consumptionCluster.update({
            where: { id: u.id },
            data: { sortOrder: u.sortOrder },
          } as Record<string, unknown>)
        )
      )
      return res.status(200).json({ ok: true })
    } catch (e) {
      console.error('CLUSTER REORDER ERROR:', e)
      return res.status(500).json({ error: String(e) })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}