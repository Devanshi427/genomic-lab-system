import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role = (session.user as Record<string, unknown>)?.role as string
  const userId = (session.user as Record<string, unknown>)?.id as string

  // ── POST: create a new transfer request ──────────────────────────────────
  if (req.method === 'POST') {
    const { fromItemId, toLabId, quantity, reason } = req.body as {
      fromItemId: number
      toLabId: number
      quantity: number
      reason?: string
    }

    if (!fromItemId || !toLabId || !quantity) {
      return res.status(400).json({ error: 'fromItemId, toLabId, and quantity are required' })
    }
    if (quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be greater than zero' })
    }

    // Load source item
    const sourceItem = await prisma.inventoryItem.findUnique({
      where: { id: fromItemId },
      include: { lab: { select: { id: true, name: true } } },
    })
    if (!sourceItem) {
      return res.status(404).json({ error: 'Source inventory item not found' })
    }
    if (sourceItem.labId === toLabId) {
      return res.status(400).json({ error: 'Source and destination lab must be different' })
    }
    if (sourceItem.quantity < quantity) {
      return res.status(400).json({
        error: `Insufficient stock. Available: ${sourceItem.quantity} ${sourceItem.unit}`,
      })
    }

    // Verify destination lab exists
    const destLab = await prisma.lab.findUnique({ where: { id: toLabId } })
    if (!destLab) {
      return res.status(404).json({ error: 'Destination lab not found' })
    }

    // Find an existing item with the same name in the destination lab,
    // or create a placeholder with quantity 0 that will be incremented on approval.
    let destItem = await prisma.inventoryItem.findFirst({
      where: {
        name: sourceItem.name,
        labId: toLabId,
      },
    })

    if (!destItem) {
      destItem = await prisma.inventoryItem.create({
        data: {
          name: sourceItem.name,
          brand: sourceItem.brand,
          category: sourceItem.category,
          type: sourceItem.type,
          quantity: 0,
          unit: sourceItem.unit,
          minThreshold: sourceItem.minThreshold,
          manufacturingDate: sourceItem.manufacturingDate,
          expiryDate: sourceItem.expiryDate,
          notes: sourceItem.notes,
          labId: toLabId,
        },
      })
    }

    const transfer = await prisma.inventoryTransfer.create({
      data: {
        fromItemId,
        toItemId: destItem.id,
        quantity,
        reason: reason ?? null,
        status: 'PENDING',
        requestedById: parseInt(userId),
      },
      include: {
        fromItem: { include: { lab: { select: { name: true } } } },
        toItem: { include: { lab: { select: { name: true } } } },
      },
    })

    return res.status(201).json(transfer)
  }

  // ── PUT: approve a pending transfer ──────────────────────────────────────
  if (req.method === 'PUT') {
    if (role !== 'INVENTORY_MANAGER' && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { transferId } = req.body as { transferId: number }
    if (!transferId) {
      return res.status(400).json({ error: 'transferId is required' })
    }

    const transfer = await prisma.inventoryTransfer.findUnique({
      where: { id: transferId },
    })
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' })
    }
    if (transfer.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only PENDING transfers can be completed' })
    }

    const sourceItem = await prisma.inventoryItem.findUnique({
      where: { id: transfer.fromItemId },
    })
    if (!sourceItem || sourceItem.quantity < transfer.quantity) {
      return res.status(400).json({ error: 'Insufficient stock at time of approval' })
    }

    const result = await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id: transfer.fromItemId },
        data: { quantity: { decrement: transfer.quantity } },
      }),
      prisma.inventoryItem.update({
        where: { id: transfer.toItemId },
        data: { quantity: { increment: transfer.quantity } },
      }),
      prisma.inventoryTransfer.update({
        where: { id: transferId },
        data: {
          status: 'COMPLETED',
          approvedById: parseInt(userId),
          completedAt: new Date(),
        },
      }),
    ])

    return res.status(200).json(result)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}