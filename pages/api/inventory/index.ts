// pages/api/inventory/index.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { writeAudit } from '../../../lib/audit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role = (session.user as Record<string, unknown>)?.role as string
  const user = session.user as { id: string }

  if (req.method === 'GET') {
    try {
      const allowed = ['ADMIN', 'BIOTECHNOLOGIST', 'INVENTORY_MANAGER', 'MANAGEMENT']
      if (!allowed.includes(role)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const items = await prisma.inventoryItem.findMany({
        include: { lab: { select: { id: true, name: true } } },
        orderBy: [{ labId: 'asc' }, { type: 'asc' }, { category: 'asc' }, { name: 'asc' }]
      })

      // Low-stock rule (unified with alerts.ts):
      //   effectiveThreshold = lowStockThreshold ?? minThreshold
      //   isLow              = quantity < effectiveThreshold  (strictly less than)
      // FIX: previously used only minThreshold with < here, while alerts.ts used
      // lowStockThreshold ?? minThreshold with <=. Both surfaces now use the same
      // field and the same operator so they agree on every item's status.
      const flagged = items.map(item => {
        const effectiveThreshold = item.lowStockThreshold ?? item.minThreshold
        return {
          ...item,
          isLow: item.quantity < effectiveThreshold,
          isExpiringSoon: item.expiryDate
            ? new Date(item.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : false,
        }
      })

      return res.status(200).json(flagged)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('GET /api/inventory error:', err)
      return res.status(500).json({ error: message })
    }
  }

  if (req.method === 'POST') {
    if (role !== 'INVENTORY_MANAGER' && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const {
      name, brand, category, type, quantity, unit, minThreshold,
      expiryDate, manufacturingDate, labId, notes
    } = req.body as {
      name: string
      brand?: string
      category: string
      type?: string
      quantity: number
      unit: string
      minThreshold: number
      expiryDate?: string
      manufacturingDate?: string
      labId: number
      notes?: string
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name,
        brand: brand ?? null,
        category,
        type: type ?? 'CHEMICAL',
        quantity,
        unit,
        minThreshold,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null,
        labId,
        notes: notes ?? null,
      },
      include: { lab: { select: { id: true, name: true } } }
    })

    await writeAudit({
      action:        'INVENTORY_CREATED',
      entityType:    'InventoryItem',
      entityId:      item.id,
      detail:        `${item.name} added to ${item.lab.name}`,
      performedById: parseInt(user.id),
    })

    return res.status(201).json(item)
  }

  if (req.method === 'PATCH') {
    if (role !== 'INVENTORY_MANAGER' && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { id, ...updates } = req.body as {
      id: number
      name?: string
      brand?: string
      category?: string
      type?: string
      quantity?: number
      unit?: string
      minThreshold?: number
      expiryDate?: string | null
      manufacturingDate?: string | null
      notes?: string | null
    }

    if (!id) return res.status(400).json({ error: 'id is required' })

    const item = await prisma.inventoryItem.update({
      where: { id: parseInt(String(id)) },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.brand !== undefined && { brand: updates.brand }),
        ...(updates.category !== undefined && { category: updates.category }),
        ...(updates.type !== undefined && { type: updates.type }),
        ...(updates.quantity !== undefined && { quantity: updates.quantity }),
        ...(updates.unit !== undefined && { unit: updates.unit }),
        ...(updates.minThreshold !== undefined && { minThreshold: updates.minThreshold }),
        ...(updates.expiryDate !== undefined && {
          expiryDate: updates.expiryDate ? new Date(updates.expiryDate) : null
        }),
        ...(updates.manufacturingDate !== undefined && {
          manufacturingDate: updates.manufacturingDate ? new Date(updates.manufacturingDate) : null
        }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
      },
      include: { lab: { select: { id: true, name: true } } }
    })

    await writeAudit({
      action:        'INVENTORY_UPDATED',
      entityType:    'InventoryItem',
      entityId:      item.id,
      detail:        `${item.name} updated`,
      performedById: parseInt(user.id),
    })

    return res.status(200).json(item)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}