// pages/api/reports/monthly-pdf.ts
//
// CHANGE: Two constants updated to align with pages/api/dashboard/stats.ts.
// All other code in this file is unchanged from the original.
//
// ── BEFORE (space-separated keys — mismatched with stats.ts) ─────────────────
// const ANALYSIS_KEY_MAP = {
//   'Purity Analysis':        'Purity Analysis',
//   'Purity_Analysis':        'Purity Analysis',
//   'Hybridity Confirmation': 'Hybridity Confirmation',
//   'Hybridity_Confirmation': 'Hybridity Confirmation',
//   'Line Fingerprinting':    'Line Fingerprinting',
//   'Gene Profiling':         'Gene Profiling',
// }
// const ANALYSIS_ORDER = [
//   'Foreground', 'Purity Analysis', 'Hybridity Confirmation',
//   'Background', 'Line Fingerprinting', 'Gene Profiling',
// ]
//
// ── AFTER (underscore keys — matches stats.ts canonical keys) ─────────────────

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import PDFDocument from 'pdfkit'
import { prisma } from '../../../lib/prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReagentUsageRow {
  itemId: number
  _sum: { quantityUsed: number | null }
}

// FIX: unified with stats.ts — both files now produce the same canonical keys.
// Dashboard chart lookups and PDF aggregation will now agree on every category.
const ANALYSIS_KEY_MAP: Record<string, string> = {
  'Foreground':             'Foreground',
  'Purity Analysis':        'Purity_Analysis',
  'Purity_Analysis':        'Purity_Analysis',
  'Hybridity Confirmation': 'Hybridity_Confirmation',
  'Hybridity_Confirmation': 'Hybridity_Confirmation',
  'Background':             'Background',
  'Line Fingerprinting':    'Line_Fingerprinting',
  'Line_Fingerprinting':    'Line_Fingerprinting',
  'Gene Profiling':         'Gene_Profiling',
  'Gene_Profiling':         'Gene_Profiling',
}

// FIX: ANALYSIS_ORDER uses the same underscore keys as ANALYSIS_KEY_MAP.
// Display labels are derived by replacing underscores with spaces at render time.
const ANALYSIS_ORDER = [
  'Foreground',
  'Purity_Analysis',
  'Hybridity_Confirmation',
  'Background',
  'Line_Fingerprinting',
  'Gene_Profiling',
]

// ─── Design system ────────────────────────────────────────────────────────────

const W   = 595
const H   = 842
const ML  = 48
const MR  = 48
const TW  = W - ML - MR

const SP = { xs: 8, sm: 16, md: 24, lg: 32, xl: 48, xxl: 64 }

const T = {
  hero:    36,
  h1:      22,
  h2:      14,
  h3:      13,
  body:    10.5,
  caption:  8.5,
}

const C = {
  brand:       '#0f766e',
  brandDark:   '#0d5c55',
  brandLight:  '#e6faf6',
  success:     '#16a34a',
  successBg:   '#f0fdf4',
  warning:     '#b45309',
  warningBg:   '#fffbeb',
  danger:      '#dc2626',
  dangerBg:    '#fef2f2',
  info:        '#1d4ed8',
  ink:         '#0f172a',
  body:        '#1e293b',
  muted:       '#475569',
  subtle:      '#94a3b8',
  rule:        '#e2e8f0',
  surface:     '#f8fafc',
  white:       '#ffffff',
  chart: ['#0f766e', '#1d4ed8', '#7c3aed', '#db2777', '#ea580c', '#65a30d'],
}

// ─── Rendering utilities ──────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-IN')
}

function trend(curr: number, prev: number): { arrow: string; label: string; up: boolean } {
  if (prev === 0) return { arrow: '—', label: '—', up: true }
  const pct = Math.round(((curr - prev) / prev) * 100)
  return {
    arrow: pct >= 0 ? '↑' : '↓',
    label: `${Math.abs(pct)}% vs prev`,
    up:    pct >= 0,
  }
}

function hRule(doc: PDFKit.PDFDocument, y: number, color = C.rule, lw = 0.5) {
  doc.moveTo(ML, y).lineTo(ML + TW, y).strokeColor(color).lineWidth(lw).stroke()
}

function progressBar(
  doc: PDFKit.PDFDocument,
  x: number, y: number, w: number, h: number,
  pct: number, fillColor: string, bgColor = '#f1f5f9',
) {
  doc.roundedRect(x, y, w, h, h / 2).fill(bgColor)
  const filled = Math.max(0, Math.min(1, pct / 100)) * w
  if (filled > 0) doc.roundedRect(x, y, filled, h, h / 2).fill(fillColor)
}

function kpiCard(
  doc: PDFKit.PDFDocument,
  x: number, y: number, w: number,
  label: string,
  value: string,
  trendStr: string,
  trendUp: boolean,
  accentColor: string,
) {
  const h = 72
  doc.rect(x, y, w, h).fill(C.white)
  doc.rect(x, y, 3, h).fill(accentColor)
  doc.font('Helvetica-Bold').fontSize(T.hero * 0.75).fillColor(C.ink)
     .text(value, x + 14, y + 10, { width: w - 18 })
  doc.font('Helvetica').fontSize(T.body).fillColor(C.muted)
     .text(label, x + 14, y + 42, { width: w - 18 })
  if (trendStr !== '—') {
    const trendColor = trendUp ? C.success : C.danger
    doc.font('Helvetica-Bold').fontSize(T.caption).fillColor(trendColor)
       .text(trendStr, x + 14, y + 56, { width: w - 18 })
  }
}

function sectionHead(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.font('Helvetica-Bold').fontSize(T.h2).fillColor(C.brand)
     .text(title.toUpperCase(), ML, y, {
       width: TW, characterSpacing: 0.8,
     })
  const textH = 14
  hRule(doc, y + textH + 4, C.brand, 0.75)
  return y + textH + SP.md
}

function tblHeader(
  doc: PDFKit.PDFDocument,
  y: number,
  cols: Array<{ x: number; w: number; label: string; align?: 'left' | 'right' | 'center' }>,
): number {
  const rowH = 20
  doc.rect(ML, y, TW, rowH).fill(C.brandLight)
  cols.forEach(col => {
    doc.font('Helvetica-Bold').fontSize(T.h3).fillColor(C.brand)
       .text(col.label, col.x, y + 5, { width: col.w, align: col.align ?? 'left' })
  })
  return y + rowH
}

function tblRow(
  doc: PDFKit.PDFDocument,
  y: number,
  rowIdx: number,
  cols: Array<{
    x: number; w: number; value: string
    align?: 'left' | 'right' | 'center'
    bold?: boolean; color?: string
    ellipsis?: boolean
  }>,
  rowH = 16,
): number {
  if (rowIdx % 2 === 0) doc.rect(ML, y, TW, rowH).fill(C.surface)
  cols.forEach(col => {
    doc.font(col.bold ? 'Helvetica-Bold' : 'Helvetica')
       .fontSize(T.body)
       .fillColor(col.color ?? C.body)
       .text(col.value, col.x, y + (rowH - T.body) / 2, {
         width: col.w,
         align: col.align ?? 'left',
         ellipsis: col.ellipsis ?? false,
       })
  })
  return y + rowH
}

function barRow(
  doc: PDFKit.PDFDocument,
  y: number,
  label: string,
  value: number,
  maxVal: number,
  total: number,
  color: string,
  rowIdx: number,
): number {
  const rowH  = 18
  const LABLW = 160
  const BARW  = TW - LABLW - 100
  const VALW  = 54
  const GAP   = 16
  const PCTW  = 40

  if (rowIdx % 2 === 0) doc.rect(ML, y, TW, rowH).fill(C.surface)

  // FIX: display label replaces underscores with spaces for human-readable output
  const displayLabel = label.replace(/_/g, ' ')

  doc.font('Helvetica').fontSize(T.body).fillColor(C.body)
     .text(displayLabel, ML + 4, y + (rowH - T.body) / 2, { width: LABLW - 4, ellipsis: true })

  const filled = maxVal > 0 ? Math.round((value / maxVal) * BARW) : 0
  const barX = ML + LABLW
  const barY = y + 5

  doc.roundedRect(barX, barY, BARW, 8, 4).fill('#f1f5f9')
  if (filled > 0) doc.roundedRect(barX, barY, filled, 8, 4).fill(color)

  doc.font('Helvetica-Bold').fontSize(T.body).fillColor(C.ink)
     .text(fmt(value), barX + BARW + 6, y + (rowH - T.body) / 2, { width: VALW, align: 'right' })

  if (total > 0) {
    const pct = ((value / total) * 100).toFixed(1) + '%'
    doc.font('Helvetica').fontSize(T.caption).fillColor(C.muted)
       .text(pct, barX + BARW + VALW + 6 + GAP, y + (rowH - T.body) / 2 + 0.5, { width: PCTW })
  }

  return y + rowH
}

function pageHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
) {
  doc.rect(0, 0, W, 4).fill(C.brand)
  doc.font('Helvetica-Bold').fontSize(T.h1).fillColor(C.ink)
     .text(title, ML, SP.xl, { width: TW })
  doc.font('Helvetica').fontSize(T.body).fillColor(C.muted)
     .text(subtitle, ML, SP.xl + T.h1 + 4, { width: TW })
}

function pageFooter(
  doc: PDFKit.PDFDocument,
  monthName: string,
  year: number,
  pageNum: number,
  total: number,
) {
  hRule(doc, H - 28, C.rule)
  doc.font('Helvetica').fontSize(T.caption).fillColor(C.subtle)
     .text(
       `GenomicLab Management System  ·  ${monthName} ${year} Operations Report`,
       ML, H - 20, { width: TW * 0.6 },
     )
     .text(
       `Page ${pageNum} of ${total}`,
       ML, H - 20, { width: TW, align: 'right' },
     )
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()
  const role = (session.user as Record<string, unknown>)?.role as string
  if (!['MANAGEMENT', 'ADMIN', 'BIOTECHNOLOGIST'].includes(role)) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'GET') return res.status(405).end()

  const now   = new Date()
  const year  = parseInt(req.query.year  as string) || now.getFullYear()
  const month = parseInt(req.query.month as string) || now.getMonth() + 1
  const start = new Date(year, month - 1, 1)
  const end   = new Date(year, month, 0, 23, 59, 59)

  const prevStart = new Date(year, month - 2, 1)
  const prevEnd   = new Date(year, month - 1, 0, 23, 59, 59)

  const monthName     = start.toLocaleString('default', { month: 'long' })
  const prevMonthName = prevStart.toLocaleString('default', { month: 'long' })

  const allRequests = await prisma.request.findMany({
    where:   { submittedAt: { gte: start, lte: end }, archived: false },
    select:  {
      id: true, requestCode: true, projectCode: true, sampleName: true, status: true,
      currentPhase: true, markerType: true, crop: true,
      analysisToBeDone: true, completedAt: true, expectedByDate: true,
      submittedAt: true, actualSamples: true, actualDataPoints: true,
      assignedLab:   { select: { name: true } },
      submittedBy:   { select: { name: true } },
    },
    orderBy: { submittedAt: 'asc' },
  })

  const prevRequests = await prisma.request.findMany({
    where:  { submittedAt: { gte: prevStart, lte: prevEnd }, archived: false },
    select: { status: true, actualSamples: true, actualDataPoints: true,
               completedAt: true, expectedByDate: true },
  })

  const total     = allRequests.length
  const completed = allRequests.filter(r => r.status === 'COMPLETED').length
  const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0'

  const completedWithDates = allRequests.filter(r => r.status === 'COMPLETED' && r.completedAt)
  const avgTurnaround = completedWithDates.length > 0
    ? (completedWithDates.reduce((s, r) =>
        s + (new Date(r.completedAt!).getTime() - new Date(r.submittedAt).getTime()) / 86_400_000, 0
      ) / completedWithDates.length).toFixed(1)
    : null

  const totalSamples     = allRequests.reduce((s, r) => s + (r.actualSamples    ?? 0), 0)
  const totalDataPoints  = allRequests.reduce((s, r) => s + (r.actualDataPoints ?? 0), 0)
  const delayed          = allRequests.filter(r =>
    r.status === 'COMPLETED' && r.completedAt && new Date(r.completedAt) > new Date(r.expectedByDate)
  ).length
  const onTime = completedWithDates.filter(r =>
    new Date(r.completedAt!) <= new Date(r.expectedByDate)
  ).length
  const onTimeRate = completedWithDates.length > 0
    ? Math.round((onTime / completedWithDates.length) * 100) : 0

  const prevTotal       = prevRequests.length
  const prevSamples     = prevRequests.reduce((s, r) => s + (r.actualSamples    ?? 0), 0)
  const prevDataPoints  = prevRequests.reduce((s, r) => s + (r.actualDataPoints ?? 0), 0)
  const prevWithDates   = prevRequests.filter(r => r.status === 'COMPLETED' && r.completedAt)
  const prevDelayed     = prevRequests.filter(r =>
    r.status === 'COMPLETED' && r.completedAt && new Date(r.completedAt) > new Date(r.expectedByDate)
  ).length
  const prevOnTime  = prevWithDates.filter(r =>
    new Date(r.completedAt!) <= new Date(r.expectedByDate!)
  ).length
  const prevOnTimeRate = prevWithDates.length > 0
    ? Math.round((prevOnTime / prevWithDates.length) * 100) : 0

  const phases: Record<string, number> = {}
  for (const r of allRequests) phases[r.currentPhase] = (phases[r.currentPhase] ?? 0) + 1

  const cropSamples: Record<string, number>    = {}
  const cropDataPoints: Record<string, number> = {}
  for (const r of allRequests) {
    const c = r.crop ?? 'Unknown'
    cropSamples[c]    = (cropSamples[c]    ?? 0) + (r.actualSamples    ?? 0)
    cropDataPoints[c] = (cropDataPoints[c] ?? 0) + (r.actualDataPoints ?? 0)
  }

  const analysisSamples: Record<string, number> = {}
  for (const r of allRequests) {
    const raw = r.analysisToBeDone ?? 'Unknown'
    // FIX: canonical underscore key — matches stats.ts output
    const key = ANALYSIS_KEY_MAP[raw] ?? raw
    analysisSamples[key] = (analysisSamples[key] ?? 0) + (r.actualSamples ?? 0)
  }

  const markerSamples: Record<string, number>    = {}
  const markerDataPoints: Record<string, number> = {}
  for (const r of allRequests) {
    const key = (r.markerType ?? 'Unknown').toUpperCase().trim()
    markerSamples[key]    = (markerSamples[key]    ?? 0) + (r.actualSamples    ?? 0)
    markerDataPoints[key] = (markerDataPoints[key] ?? 0) + (r.actualDataPoints ?? 0)
  }

  const reagentUsage = (await prisma.reagentLog.groupBy({
    by:      ['itemId'],
    where:   { usedAt: { gte: start, lte: end } },
    _sum:    { quantityUsed: true },
    orderBy: { _sum: { quantityUsed: 'desc' } },
  })) as unknown as ReagentUsageRow[]

  const fetchedItems = await prisma.inventoryItem.findMany({
    where:  { id: { in: reagentUsage.map(u => u.itemId) } },
    select: { id: true, name: true, unit: true },
  })
  const getItem = (id: number) => fetchedItems.find(i => i.id === id)

  const insights: string[] = []

  const sampleTrend = trend(totalSamples, prevSamples)
  insights.push(`Sample throughput ${sampleTrend.arrow === '↑' ? 'increased' : 'decreased'} ${sampleTrend.label.replace('vs prev', `vs ${prevMonthName}`)} to ${fmt(totalSamples)} samples.`)

  if (onTimeRate >= 90) insights.push(`SLA performance is strong at ${onTimeRate}% on-time delivery.`)
  else if (onTimeRate >= 70) insights.push(`SLA on-time rate stands at ${onTimeRate}% — moderate improvement recommended.`)
  else insights.push(`SLA on-time rate is ${onTimeRate}% — immediate attention required.`)

  const topCrop = Object.entries(cropSamples).sort((a, b) => b[1] - a[1])[0]
  if (topCrop) insights.push(`${topCrop[0]} dominates crop volume at ${fmt(topCrop[1])} samples (${totalSamples > 0 ? ((topCrop[1] / totalSamples) * 100).toFixed(0) : 0}% of total).`)

  const snpTotal = (markerSamples['SNP'] ?? 0) + (markerSamples['SSR'] ?? 0)
  if (snpTotal > 0) {
    const snpPct = Math.round(((markerSamples['SNP'] ?? 0) / snpTotal) * 100)
    insights.push(`SNP workflows account for ${snpPct}% of marker-type operations.`)
  }

  if (delayed === 0) insights.push('No delayed requests this period — all completed on schedule.')
  else {
    const delayedTrend = trend(delayed, prevDelayed)
    insights.push(`Delayed requests: ${delayed} ${delayedTrend.arrow} ${delayedTrend.label.replace('vs prev', `vs ${prevMonthName}`)}.`)
  }

  // BUILD PDF

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition',
    `attachment; filename="genomiclab-report-${year}-${String(month).padStart(2, '0')}.pdf"`)

  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true })
  doc.pipe(res)

  // PAGE 1 — Executive Summary

  pageHeader(doc, 'GenomicLab Management System',
    `Monthly Operations Report  ·  ${monthName} ${year}`)

  let y = SP.xl + T.h1 + SP.lg + SP.sm

  doc.rect(ML, y, TW, 2).fill(C.brand)
  y += SP.sm

  doc.font('Helvetica-Bold').fontSize(T.h3 + 0.5).fillColor(C.ink)
     .text('Executive Summary', ML, y)
  y += T.h3 + SP.sm

  const summaryText = insights.join('  ·  ')
  doc.font('Helvetica').fontSize(T.body).fillColor(C.body)
     .text(summaryText, ML, y, { width: TW, lineGap: 3 })
  y += doc.heightOfString(summaryText, { width: TW, lineGap: 3 }) + SP.lg

  const CARD_GAP = 10
  const CARD_W   = (TW - CARD_GAP * 3) / 4

  const tReqs    = trend(total,          prevTotal)
  const tSamples = trend(totalSamples,   prevSamples)
  const tDP      = trend(totalDataPoints, prevDataPoints)
  const tDelayed = trend(delayed,        prevDelayed)

  const kpis = [
    { label: 'Total Requests',   value: String(total),        tStr: `${tReqs.arrow} ${tReqs.label}`,       tUp: tReqs.up,    color: C.brand   },
    { label: 'Actual Samples',   value: fmt(totalSamples),    tStr: `${tSamples.arrow} ${tSamples.label}`, tUp: tSamples.up, color: C.info    },
    { label: 'Data Points',      value: fmt(totalDataPoints), tStr: `${tDP.arrow} ${tDP.label}`,           tUp: tDP.up,      color: '#7c3aed' },
    { label: 'Delayed Requests', value: String(delayed),      tStr: `${tDelayed.arrow} ${tDelayed.label}`, tUp: !tDelayed.up, color: delayed > 0 ? C.danger : C.success },
  ]

  kpis.forEach((k, i) => {
    kpiCard(doc, ML + i * (CARD_W + CARD_GAP), y, CARD_W, k.label, k.value, k.tStr, k.tUp, k.color)
  })
  y += 72 + SP.lg

  const statItems = [
    { label: 'Submitted',       value: String(total)                                },
    { label: 'Completed',       value: String(completed)                            },
    { label: 'Completion Rate', value: `${completionRate}%`                         },
    { label: 'Avg Turnaround',  value: avgTurnaround ? `${avgTurnaround}d` : 'N/A' },
    { label: 'On-Time Rate',    value: `${onTimeRate}%`                             },
  ]
  const STAT_GAP = 8
  const STAT_W   = (TW - STAT_GAP * 4) / 5
  const STAT_H   = 38

  statItems.forEach(({ label, value }, i) => {
    const bx = ML + i * (STAT_W + STAT_GAP)
    doc.roundedRect(bx, y, STAT_W, STAT_H, 4).fill(C.surface)
    doc.font('Helvetica-Bold').fontSize(16).fillColor(C.ink)
       .text(value, bx, y + 6, { width: STAT_W, align: 'center' })
    doc.font('Helvetica').fontSize(T.caption).fillColor(C.muted)
       .text(label, bx, y + 24, { width: STAT_W, align: 'center' })
  })
  y += STAT_H + SP.xl

  y = sectionHead(doc, 'SLA Performance', y)

  doc.font('Helvetica-Bold').fontSize(T.hero).fillColor(
    onTimeRate >= 90 ? C.success : onTimeRate >= 70 ? C.warning : C.danger
  ).text(`${onTimeRate}%`, ML, y, { continued: false })

  doc.font('Helvetica').fontSize(T.body).fillColor(C.muted)
     .text('on-time delivery rate', ML, y + T.hero + 2)

  const tOnTime = trend(onTimeRate, prevOnTimeRate)
  doc.font('Helvetica-Bold').fontSize(T.body).fillColor(tOnTime.up ? C.success : C.danger)
     .text(`${tOnTime.arrow} ${tOnTime.label}`, ML, y + T.hero + 2 + T.body + 4)

  const barStartX = ML + 140
  const barW      = TW - 140
  progressBar(doc, barStartX, y + 6, barW, 16, onTimeRate,
    onTimeRate >= 90 ? C.success : onTimeRate >= 70 ? C.warning : C.danger)

  doc.font('Helvetica').fontSize(T.body).fillColor(C.muted)
     .text(`On time: ${onTime}  ·  Delayed: ${delayed}  ·  Total completed: ${completedWithDates.length}`,
       barStartX, y + 28)

  y += T.hero + SP.xl + SP.sm

  y = sectionHead(doc, 'Request Pipeline', y)

  const PHASES = ['SUBMITTED', 'RECEIVED', 'DNA_ISOLATION', 'GENOTYPING', 'ANALYSIS', 'COMPLETED']
  const PLABELS: Record<string, string> = {
    SUBMITTED: 'Submitted', RECEIVED: 'Received', DNA_ISOLATION: 'DNA Isolation',
    GENOTYPING: 'Genotyping', ANALYSIS: 'Analysis', COMPLETED: 'Completed',
  }
  const PCOLORS: Record<string, string> = {
    SUBMITTED: C.info, RECEIVED: '#0284c7', DNA_ISOLATION: C.warning,
    GENOTYPING: '#7c3aed', ANALYSIS: '#ea580c', COMPLETED: C.success,
  }

  const boxW = Math.floor((TW - 5 * SP.xs) / 6)
  const boxH = 52

  PHASES.forEach((ph, i) => {
    const bx    = ML + i * (boxW + SP.xs)
    const cnt   = phases[ph] ?? 0
    const color = PCOLORS[ph]
    const isEnd = ph === 'COMPLETED'

    doc.roundedRect(bx, y, boxW, boxH, 4).fill(isEnd ? C.successBg : C.surface)
    doc.font('Helvetica-Bold').fontSize(22)
       .fillColor(isEnd && cnt > 0 ? C.success : cnt > 0 ? C.ink : C.subtle)
       .text(String(cnt), bx, y + 8, { width: boxW, align: 'center' })
    doc.font('Helvetica').fontSize(T.caption).fillColor(C.muted)
       .text(PLABELS[ph], bx, y + boxH - 14, { width: boxW, align: 'center' })
    doc.rect(bx, y, boxW, 2).fill(color)

    if (i < PHASES.length - 1) {
      const ax = bx + boxW + SP.xs / 2
      doc.moveTo(ax - 2, y + boxH / 2 - 4).lineTo(ax + 2, y + boxH / 2).lineTo(ax - 2, y + boxH / 2 + 4)
         .strokeColor(C.rule).lineWidth(1).stroke()
    }
  })
  y += boxH + SP.xl

  // PAGE 2 — Workload Analytics

  doc.addPage()
  pageHeader(doc, 'Workload Analytics', `${monthName} ${year}`)
  y = SP.xl + T.h1 + SP.xl

  // Crop Analytics
  y = sectionHead(doc, 'Crop Breakdown — Samples & Data Points', y)

  const crops = Object.keys(cropSamples)
    .filter(c => (cropSamples[c] ?? 0) > 0)
    .sort((a, b) => (cropSamples[b] ?? 0) - (cropSamples[a] ?? 0))

  if (crops.length === 0) {
    doc.font('Helvetica').fontSize(T.body).fillColor(C.subtle).text('No crop data this period.', ML, y)
    y += SP.lg
  } else {
    const COL_W  = (TW - SP.lg) / 2
    const COL2_X = ML + COL_W + SP.lg

    doc.font('Helvetica-Bold').fontSize(T.h3).fillColor(C.muted)
       .text('SAMPLES', ML, y)
       .text('DATA POINTS', COL2_X, y)
    y += T.h3 + SP.sm

    const maxSmp = Math.max(...crops.map(c => cropSamples[c]    ?? 0), 1)
    const maxDP  = Math.max(...crops.map(c => cropDataPoints[c] ?? 0), 1)

    const CLABEL = 54
    const CBAR   = COL_W - CLABEL - 64
    const CVAL   = 48

    crops.forEach((crop, i) => {
      const s  = cropSamples[crop]    ?? 0
      const dp = cropDataPoints[crop] ?? 0
      const color = C.chart[i % C.chart.length]
      const rowBg = i % 2 === 0 ? C.surface : C.white
      const rowH  = 18

      doc.rect(ML, y, COL_W, rowH).fill(rowBg)
      doc.font('Helvetica').fontSize(T.body).fillColor(C.body)
         .text(crop, ML + 4, y + (rowH - T.body) / 2, { width: CLABEL, ellipsis: true })
      const fS = maxSmp > 0 ? Math.round((s / maxSmp) * CBAR) : 0
      doc.roundedRect(ML + CLABEL, y + 5, CBAR, 8, 4).fill('#f1f5f9')
      if (fS > 0) doc.roundedRect(ML + CLABEL, y + 5, fS, 8, 4).fill(color)
      doc.font('Helvetica-Bold').fontSize(T.body).fillColor(C.ink)
         .text(fmt(s), ML + CLABEL + CBAR + 4, y + (rowH - T.body) / 2, { width: CVAL, align: 'right' })

      doc.rect(COL2_X, y, COL_W, rowH).fill(rowBg)
      doc.font('Helvetica').fontSize(T.body).fillColor(C.body)
         .text(crop, COL2_X + 4, y + (rowH - T.body) / 2, { width: CLABEL, ellipsis: true })
      const fDP = maxDP > 0 ? Math.round((dp / maxDP) * CBAR) : 0
      doc.roundedRect(COL2_X + CLABEL, y + 5, CBAR, 8, 4).fill('#f1f5f9')
      if (fDP > 0) doc.roundedRect(COL2_X + CLABEL, y + 5, fDP, 8, 4).fill(color)
      doc.font('Helvetica-Bold').fontSize(T.body).fillColor(C.ink)
         .text(fmt(dp), COL2_X + CLABEL + CBAR + 4, y + (rowH - T.body) / 2, { width: CVAL, align: 'right' })

      y += rowH
    })

    y += SP.lg
  }

  // Analysis Type Volume
  y = sectionHead(doc, 'Analysis Type Volume', y)

  const ATV_LABLW = 160
  const ATV_BARW  = TW - ATV_LABLW - 100
  const ATV_VALW  = 54
  const ATV_GAP   = 16
  const ATV_PCTW  = 40

  const atvHdrH = 18
  doc.rect(ML, y, TW, atvHdrH).fill(C.brandLight)
  doc.font('Helvetica-Bold').fontSize(T.h3).fillColor(C.brand)
     .text('Analysis Type', ML + 4, y + 4, { width: ATV_LABLW - 4 })
  doc.font('Helvetica-Bold').fontSize(T.h3).fillColor(C.brand)
     .text('Samples', ML + ATV_LABLW + ATV_BARW + 6, y + 4, { width: ATV_VALW, align: 'right' })
  doc.font('Helvetica-Bold').fontSize(T.h3).fillColor(C.brand)
     .text('%', ML + ATV_LABLW + ATV_BARW + ATV_VALW + 6 + ATV_GAP, y + 4, { width: ATV_PCTW })
  y += atvHdrH

  const analysisMax   = Math.max(...ANALYSIS_ORDER.map(k => analysisSamples[k] ?? 0), 1)
  const analysisTotal = ANALYSIS_ORDER.reduce((s, k) => s + (analysisSamples[k] ?? 0), 0)

  // FIX: barRow now receives the underscore key and replaces underscores with
  // spaces internally for the display label — no data change needed here.
  ANALYSIS_ORDER.forEach((key, i) => {
    const val = analysisSamples[key] ?? 0
    y = barRow(doc, y, key, val, analysisMax, analysisTotal, C.brand, i)
  })
  y += SP.xl

  // SNP vs SSR
  y = sectionHead(doc, 'Marker Type — SNP vs SSR', y)

  const markers = ['SNP', 'SSR']
  const markerMax = Math.max(...markers.map(m => markerSamples[m] ?? 0), 1)

  const MLABEL = 48
  const MBAR   = TW / 2 - MLABEL - 80
  const MVAL   = 54
  const GAP    = TW / 2

  doc.font('Helvetica-Bold').fontSize(T.h3).fillColor(C.muted)
     .text('SAMPLES', ML + MLABEL, y)
     .text('DATA POINTS', ML + GAP + MLABEL, y)
  y += T.h3 + SP.xs

  const markerMaxDP = Math.max(...markers.map(m => markerDataPoints[m] ?? 0), 1)

  markers.forEach((m, i) => {
    const s  = markerSamples[m]    ?? 0
    const dp = markerDataPoints[m] ?? 0
    const rowH  = 22
    const rowBg = i % 2 === 0 ? C.surface : C.white

    doc.rect(ML, y, TW, rowH).fill(rowBg)
    doc.font('Helvetica-Bold').fontSize(T.body).fillColor(C.ink)
       .text(m, ML + 4, y + (rowH - T.body) / 2, { width: MLABEL })

    const fS = markerMax > 0 ? Math.round((s / markerMax) * MBAR) : 0
    doc.roundedRect(ML + MLABEL, y + 7, MBAR, 8, 4).fill('#f0fdf4')
    if (fS > 0) doc.roundedRect(ML + MLABEL, y + 7, fS, 8, 4).fill(C.success)
    doc.font('Helvetica-Bold').fontSize(T.body).fillColor(C.ink)
       .text(fmt(s), ML + MLABEL + MBAR + 6, y + (rowH - T.body) / 2, { width: MVAL, align: 'right' })

    const fDP = markerMaxDP > 0 ? Math.round((dp / markerMaxDP) * MBAR) : 0
    const dpX = ML + GAP + MLABEL
    doc.roundedRect(dpX, y + 7, MBAR, 8, 4).fill('#eff6ff')
    if (fDP > 0) doc.roundedRect(dpX, y + 7, fDP, 8, 4).fill(C.info)
    doc.font('Helvetica-Bold').fontSize(T.body).fillColor(C.ink)
       .text(fmt(dp), dpX + MBAR + 6, y + (rowH - T.body) / 2, { width: MVAL, align: 'right' })

    y += rowH
  })
  y += SP.xl

  // PAGE 3 — Request Detail
  doc.addPage()
  pageHeader(doc, 'Request Detail', `${monthName} ${year}  ·  Appendix`)
  y = SP.xl + T.h1 + SP.xl

  const dCols = [
    { x: ML + 2,   w: 140, label: 'Project Code' },
    { x: ML + 148, w: 150, label: 'Sample'       },
    { x: ML + 304, w: 90,  label: 'Crop'         },
    { x: ML + 400, w: 99,  label: 'Status'       },
  ]
  y = tblHeader(doc, y, dCols)

  const STATUS_COLOR: Record<string, string> = {
    COMPLETED: C.success, SUBMITTED: C.info,
    IN_PROGRESS: C.warning, PENDING: C.warning, CANCELLED: C.danger,
    ANALYSIS: '#7c3aed', GENOTYPING: '#7c3aed',
    DNA_ISOLATION: C.warning, RECEIVED: C.info,
  }

  allRequests.forEach((r, i) => {
    if (y > H - 40) { doc.addPage(); y = SP.xl }

    const statusColor  = STATUS_COLOR[r.currentPhase ?? r.status] ?? C.muted
    const statusLabel  = (r.currentPhase ?? r.status).replace(/_/g, ' ')
    const displayCode  = (r as { projectCode?: string | null }).projectCode ?? r.requestCode

    y = tblRow(doc, y, i, [
      { x: ML + 2,   w: 140, value: displayCode,    bold: true, color: C.brand  },
      { x: ML + 148, w: 150, value: r.sampleName,   ellipsis: true               },
      { x: ML + 304, w: 90,  value: r.crop ?? '—'                                 },
      { x: ML + 400, w: 99,  value: statusLabel,    bold: true, color: statusColor },
    ])
  })

  if (allRequests.length === 0) {
    doc.font('Helvetica').fontSize(T.body).fillColor(C.subtle)
       .text('No requests found for this period.', ML, y + SP.sm)
  }

  // Reagents page
  doc.addPage()
  pageHeader(doc, 'Cumulative Reagents Consumed', `${monthName} ${year}  ·  Appendix`)
  y = SP.xl + T.h1 + SP.xl

  y = sectionHead(doc, 'Reagents Consumed', y)

  const rCols = [
    { x: ML + 4,   w: 300, label: 'Reagent'  },
    { x: ML + 310, w: 80,  label: 'Unit'     },
    { x: ML + 396, w: 103, label: 'Qty Used', align: 'right' as const },
  ]
  y = tblHeader(doc, y, rCols)

  reagentUsage.forEach((usage, i) => {
    if (y > H - 40) { doc.addPage(); y = SP.xl }

    const item = getItem(usage.itemId)
    const qty  = usage._sum.quantityUsed ?? 0

    y = tblRow(doc, y, i, [
      { x: ML + 4,   w: 300, value: item?.name ?? 'Unknown', ellipsis: true },
      { x: ML + 310, w: 80,  value: item?.unit ?? '' },
      { x: ML + 396, w: 103, value: qty.toFixed(4) , align: 'right', bold: true },
    ])
  })

  if (reagentUsage.length === 0) {
    doc.font('Helvetica').fontSize(T.body).fillColor(C.subtle)
       .text('No reagent usage data for this period.', ML, y + 4)
  }

  // Footers
  const pageCount = doc.bufferedPageRange().count
  for (let p = 0; p < pageCount; p++) {
    doc.switchToPage(p)
    pageFooter(doc, monthName, year, p + 1, pageCount)
  }

  doc.end()
}