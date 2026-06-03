// pages/api/dashboard/stats.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'BREEDER' && role !== 'BIOTECHNOLOGIST' && role !== 'INVENTORY_MANAGER' && role !== 'ADMIN' && role !== 'MANAGEMENT') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const yearParam  = req.query.year  as string | undefined
  const monthParam = req.query.month as string | undefined
  const cropParam  = req.query.crop  as string | undefined

  const parsedYear  = yearParam  ? parseInt(yearParam,  10) : null
  const parsedMonth = monthParam ? parseInt(monthParam, 10) : null

  type WhereClause = {
    archived: boolean
    crop?: string
    year?: number
    submittedAt?: { gte: Date; lt: Date }
  }

  const where: WhereClause = { archived: false }

  if (cropParam) where.crop = cropParam

  if (parsedYear && !isNaN(parsedYear)) {
    if (parsedMonth && !isNaN(parsedMonth)) {
      where.submittedAt = {
        gte: new Date(parsedYear, parsedMonth - 1, 1),
        lt:  new Date(parsedYear, parsedMonth,     1),
      }
    } else {
      where.year = parsedYear
    }
  }

  const allRequests = await prisma.request.findMany({
    where,
    select: {
      id:               true,
      status:           true,
      currentPhase:     true,
      markerType:       true,
      snpCount:         true,
      ssrCount:         true,
      markersPerSample: true,
      completedAt:      true,
      expectedByDate:   true,
      submittedAt:      true,
      actualSamples:    true,
      actualDataPoints: true,
      crop:             true,
      analysisToBeDone: true,
    },
  })

  const requests =
    parsedMonth && !isNaN(parsedMonth) && (!parsedYear || isNaN(parsedYear))
      ? allRequests.filter(
          r => new Date(r.submittedAt).getMonth() + 1 === parsedMonth
        )
      : allRequests

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const total = requests.length

  const completedThisMonth = requests.filter(r =>
    r.status === 'COMPLETED' &&
    r.completedAt != null &&
    new Date(r.completedAt) >= startOfMonth
  ).length

  const pending    = requests.filter(r => r.status === 'PENDING').length
  const inProgress = requests.filter(r => r.status === 'IN_PROGRESS').length

  const completedAll = requests.filter(r => r.status === 'COMPLETED' && r.completedAt != null)
  const onTimeCount  = completedAll.filter(
    r => new Date(r.completedAt!) <= new Date(r.expectedByDate)
  ).length
  const delayedCount = completedAll.length - onTimeCount
  const onTimeRate   = completedAll.length > 0
    ? Math.round((onTimeCount / completedAll.length) * 100)
    : 0

  const statusBreakdown: Record<string, number> = {}
  for (const r of requests) {
    statusBreakdown[r.status] = (statusBreakdown[r.status] ?? 0) + 1
  }

  const phaseDistribution: Record<string, number> = {}
  for (const r of requests) {
    phaseDistribution[r.currentPhase] = (phaseDistribution[r.currentPhase] ?? 0) + 1
  }

  // ── SNP / SSR aggregation ───────────────────────────────────────────────
  //
  // Marker count resolution order per request:
  //
  //   SNP-only  → snpCount ?? markersPerSample ?? 0
  //               (markersPerSample IS the SNP marker count for a pure SNP request)
  //
  //   SSR-only  → ssrCount ?? markersPerSample ?? 0
  //               (same logic for pure SSR requests)
  //
  //   BOTH      → snpCount and ssrCount used as-is (explicit split required;
  //               markersPerSample cannot be safely attributed to either type alone)
  //
  // Data points formula (per spec):
  //   SNP data points = resolvedSnpMarkers × actualSamples
  //   SSR data points = resolvedSsrMarkers × actualSamples

  const testTypeSplit:      Record<string, number> = {}
  const testTypeSamples:    Record<string, number> = {}
  const testTypeDataPoints: Record<string, number> = {}

  for (const r of requests) {
    const mt      = (r.markerType ?? 'Unknown').toUpperCase().trim()
    const samples = r.actualSamples ?? 0

    if (mt === 'BOTH') {
      const snp = r.snpCount ?? 0
      const ssr = r.ssrCount ?? 0

      testTypeSplit['SNP'] = (testTypeSplit['SNP'] ?? 0) + 1
      testTypeSplit['SSR'] = (testTypeSplit['SSR'] ?? 0) + 1

      testTypeSamples['SNP'] = (testTypeSamples['SNP'] ?? 0) + samples
      testTypeSamples['SSR'] = (testTypeSamples['SSR'] ?? 0) + samples

      testTypeDataPoints['SNP'] = (testTypeDataPoints['SNP'] ?? 0) + (snp * samples)
      testTypeDataPoints['SSR'] = (testTypeDataPoints['SSR'] ?? 0) + (ssr * samples)

    } else if (mt === 'SNP') {
      // FIX: fall back to markersPerSample when snpCount is null.
      // For a pure SNP request markersPerSample equals the SNP marker count.
      const snp = r.snpCount ?? r.markersPerSample ?? 0

      testTypeSplit['SNP']      = (testTypeSplit['SNP']      ?? 0) + 1
      testTypeSamples['SNP']    = (testTypeSamples['SNP']    ?? 0) + samples
      testTypeDataPoints['SNP'] = (testTypeDataPoints['SNP'] ?? 0) + (snp * samples)

    } else if (mt === 'SSR') {
      // FIX: fall back to markersPerSample when ssrCount is null.
      const ssr = r.ssrCount ?? r.markersPerSample ?? 0

      testTypeSplit['SSR']      = (testTypeSplit['SSR']      ?? 0) + 1
      testTypeSamples['SSR']    = (testTypeSamples['SSR']    ?? 0) + samples
      testTypeDataPoints['SSR'] = (testTypeDataPoints['SSR'] ?? 0) + (ssr * samples)

    } else {
      // Unknown / other marker types
      testTypeSplit[mt]      = (testTypeSplit[mt]      ?? 0) + 1
      testTypeSamples[mt]    = (testTypeSamples[mt]    ?? 0) + samples
      testTypeDataPoints[mt] = (testTypeDataPoints[mt] ?? 0) + (r.actualDataPoints ?? 0)
    }
  }

  const totalActualSamples = requests.reduce(
    (sum, r) => sum + (r.actualSamples ?? 0), 0
  )
  const totalActualDataPoints = requests.reduce(
    (sum, r) => sum + (r.actualDataPoints ?? 0), 0
  )

  const cropSamples: Record<string, number> = {}
  const cropDataPoints: Record<string, number> = {}
  for (const r of requests) {
    const crop = r.crop ?? 'Unknown'
    cropSamples[crop]    = (cropSamples[crop]    ?? 0) + (r.actualSamples    ?? 0)
    cropDataPoints[crop] = (cropDataPoints[crop] ?? 0) + (r.actualDataPoints ?? 0)
  }

  const analysisSamples: Record<string, number> = {}
  for (const r of requests) {
    const raw = r.analysisToBeDone ?? 'Unknown'
    const key = ANALYSIS_KEY_MAP[raw] ?? raw
    analysisSamples[key] = (analysisSamples[key] ?? 0) + (r.actualSamples ?? 0)
  }

  return res.status(200).json({
    total,
    completedThisMonth,
    pending,
    inProgress,
    onTimeRate,
    delayed: delayedCount,
    statusBreakdown,
    phaseDistribution,
    testTypeSplit,
    testTypeSamples,
    testTypeDataPoints,
    onTimeVsDelayed:       { onTime: onTimeCount, delayed: delayedCount },
    totalActualSamples,
    totalActualDataPoints,
    cropSamples,
    cropDataPoints,
    analysisSamples,
  })
}