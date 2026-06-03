// pages/api/dashboard/export.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import * as XLSX from 'xlsx'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()
  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== "MANAGEMENT" && role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" })
  }
  if (req.method !== "GET") return res.status(405).end()

  const { type } = req.query
  const wb = XLSX.utils.book_new()
  let filename = "dashboard-export.xlsx"

  if (type === "reagent-summary") {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const grouped = await prisma.reagentLog.groupBy({
      by: ["itemId"],
      where: { usedAt: { gte: startOfMonth } },
      _sum: { quantityUsed: true },
      orderBy: { _sum: { quantityUsed: "desc" } },
    })
    const itemIds = grouped.map(g => g.itemId)
    const items = await prisma.inventoryItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, unit: true }
    })
    const rows = grouped.map(g => {
      const item = items.find(i => i.id === g.itemId)
      return {
        "Reagent":      item?.name ?? "Unknown",
        "Unit":         item?.unit ?? "",
        "Total Used":   g._sum.quantityUsed ?? 0,
        "Period":       `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`,
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, "Reagent Summary")
    filename = `reagent-summary-${now.toISOString().slice(0,10)}.xlsx`

  } else if (type === "requests") {
    const requests = await prisma.request.findMany({
      include: {
        submittedBy: { select: { name: true } },
        assignedLab: { select: { name: true } }
      },
      orderBy: { submittedAt: "desc" }
    })
    const rows = requests.map(r => ({
      "Request Code":    r.requestCode,
      "Sample Name":     r.sampleName,
      "Crop":            r.crop ?? "",
      "Test Type":       r.testType,
      "Status":          r.status,
      "Current Phase":   r.currentPhase,
      "Submitted By":    r.submittedBy.name,
      "Lab":             r.assignedLab?.name ?? "Unassigned",
      "Submitted At":    new Date(r.submittedAt).toLocaleDateString("en-GB"),
      "Expected By":     new Date(r.expectedByDate).toLocaleDateString("en-GB"),
      "Completed At":    r.completedAt ? new Date(r.completedAt).toLocaleDateString("en-GB") : "",
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, "All Requests")
    filename = `requests-${new Date().toISOString().slice(0,10)}.xlsx`

  } else {
    return res.status(400).json({ error: "Invalid export type" })
  }

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" })
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
  return res.status(200).send(buffer)
}
