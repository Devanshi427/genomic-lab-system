// pages/api/inventory/import.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { writeAudit } from '../../../lib/audit'
import type { ImportRow } from '../../../lib/inventoryImportUtils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'INVENTORY_MANAGER' && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    rows,
    labId,
    minThreshold  = 10,
    clearExisting = false,
  } = req.body as {
    rows:          ImportRow[]
    labId:         number
    minThreshold:  number
    clearExisting: boolean
  }

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No rows provided' })
  }

  const parsedLabId = Number(labId)
  if (!parsedLabId || isNaN(parsedLabId)) {
    return res.status(400).json({ error: 'Please select a valid lab' })
  }

  try {
    if (clearExisting) {
      await prisma.inventoryItem.deleteMany({ where: { labId: parsedLabId } })
    }

    const created = await prisma.$transaction(
      rows.map(row =>
        prisma.inventoryItem.create({
          data: {
            name:              row.name,
            brand:             row.brand      || null,
            category:          row.category,
            type:              row.type,
            quantity:          row.quantity,
            unit:              row.unit,
            minThreshold:      Number(minThreshold),
            manufacturingDate: row.manufacturingDate ? new Date(row.manufacturingDate) : null,
            expiryDate:        row.expiryDate        ? new Date(row.expiryDate)        : null,
            labId:             parsedLabId,
            notes:             row.catalogueNumber   ? `Cat: ${row.catalogueNumber}`   : null,
          },
        })
      )
    )

    await writeAudit({
      action:        'INVENTORY_IMPORTED',
      entityType:    'InventoryItem',
      entityId:      0,
      detail:        `Imported ${created.length} items into lab ${parsedLabId}`,
      performedById: parseInt((session.user as { id: string }).id),
    })

    return res.status(200).json({ imported: created.length })
  } catch (err: unknown) {
    console.error('Import error:', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Import failed' })
  }
}