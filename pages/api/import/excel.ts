import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import * as XLSX from 'xlsx'
import formidable from 'formidable'

export const config = { api: { bodyParser: false } }

// ── 30-day analyses ──────────────────────────────────────────────────────────
const THIRTY_DAY_ANALYSES = ['background', 'line fingerprinting', 'line_fingerprinting']

export function getTestType(analysisToBeDone: string | null): '15-DAY' | '30-DAY' {
  const lower = (analysisToBeDone ?? '').toLowerCase()
  return THIRTY_DAY_ANALYSES.some(a => lower.includes(a)) ? '30-DAY' : '15-DAY'
}

export function getDodDays(testType: '15-DAY' | '30-DAY'): number {
  return testType === '30-DAY' ? 30 : 15
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function rawStr(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return ''
    const d = String(value.getDate()).padStart(2, '0')
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const y = value.getFullYear()
    return `${d}.${m}.${y}`
  }
  return String(value).trim()
}

function safeDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value
  }
  const str = String(value).trim()
  if (str === '' || str.toUpperCase() === 'NA' || str === '-' || str === '0') return null

  // DD.MM.YYYY
  const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dotMatch) {
    const [, d, m, y] = dotMatch
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    return isNaN(date.getTime()) ? null : date
  }

  // DD/MM/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, d, m, y] = slashMatch
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    return isNaN(date.getTime()) ? null : date
  }

  // DD-MM-YYYY
  const dashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dashMatch) {
    const [, d, m, y] = dashMatch
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    return isNaN(date.getTime()) ? null : date
  }

  // Excel numeric serial
  if (/^\d+(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str)
    if (serial >= 1 && serial <= 2958465) {
      const excelEpoch = new Date(1899, 11, 30)
      const date = new Date(excelEpoch.getTime() + serial * 86400000)
      return isNaN(date.getTime()) ? null : date
    }
    return null
  }

  const parsed = new Date(str)
  return isNaN(parsed.getTime()) ? null : parsed
}

function safeInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return null
  const str = String(value).replace(/,/g, '').trim()
  if (str === '' || str.toUpperCase() === 'NA') return null
  const num = parseInt(str)
  return isNaN(num) ? null : num
}

function safeStr(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return null
  const str = String(value).replace(/,/g, '').trim()
  if (str === '' || str.toUpperCase() === 'NA') return null
  return str
}

function safeQty(value: unknown): number {
  if (value === null || value === undefined) return 0
  const str = String(value).trim().toLowerCase()
  if (str === '' || str === 'nil' || str === 'na' || str === 'n/a' || str === '-') return 0
  const match = str.match(/^(\d+\.?\d*)/)
  if (match) return parseFloat(match[1])
  return 0
}

function normaliseType(value: unknown): string {
  const s = rawStr(value).toLowerCase()
  if (s.includes('consumable')) return 'CONSUMABLE'
  return 'CHEMICAL'
}

function resolveLabId(value: unknown, targetLabId: number): number {
  const str = rawStr(value)
  const match = str.match(/lab\s*(\d+)/i)
  if (match) return parseInt(match[1])
  return targetLabId
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).end()

  const role = (session.user as Record<string, unknown>)?.role as string
  if (role !== 'ADMIN' && role !== 'INVENTORY_MANAGER') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method !== 'POST') return res.status(405).end()

  const form = formidable({})
  const [fields, files] = await form.parse(req)

  const sheetType = Array.isArray(fields.sheetType)
    ? fields.sheetType[0]
    : (fields.sheetType ?? 'requests')

  const labIdField = Array.isArray(fields.labId)
    ? fields.labId[0]
    : (fields.labId ?? '1')

  const targetLabId = parseInt(labIdField) || 1

  const uploadedFile = files.excel
  if (!uploadedFile?.[0]) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  const workbook = XLSX.readFile(uploadedFile[0].filepath, {
    cellDates: false,
    raw: false,
  })

  const sheetName =
    sheetType === 'inventory' && workbook.SheetNames.includes('Sheet2')
      ? 'Sheet2'
      : workbook.SheetNames[0]

  const sheet = workbook.Sheets[sheetName]

  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    header: 1,
  }) as unknown[][]

  if (rawRows.length < 2) {
    return res.status(400).json({ error: 'The Excel sheet is empty' })
  }

  const headers = (rawRows[0] as unknown[]).map(h => rawStr(h))
  let remarksCount = 0
  const fixedHeaders = headers.map(h => {
    if (h === 'Remarks') {
      remarksCount++
      return remarksCount === 1 ? 'Remarks_Pre' : 'Remarks_Post'
    }
    return h
  })

  const rows: Record<string, unknown>[] = rawRows.slice(1).map(row => {
    const obj: Record<string, unknown> = {}
    fixedHeaders.forEach((key, i) => {
      obj[key] = (row as unknown[])[i] ?? ''
    })
    return obj
  })

  if (rows.length === 0) {
    return res.status(400).json({ error: 'The Excel sheet has no data rows' })
  }

  console.log(`\n=== IMPORT STARTED (sheet: ${sheetName}, type: ${sheetType}) ===`)
  console.log('Row count:', rows.length)
  console.log('Columns:', fixedHeaders.join(', '))
  console.log('FIRST ROW RAW:', JSON.stringify(rows[0], null, 2))

  let imported = 0
  let skipped = 0
  const skippedDetails: string[] = []
  const errors: string[] = []

  // ── REQUESTS IMPORT ────────────────────────────────────────────────────────

  if (sheetType === 'requests') {
    const defaultSubmitter = await prisma.user.findFirst({ where: { role: 'BREEDER' } })
    if (!defaultSubmitter) {
      return res.status(400).json({ error: 'No BREEDER user found. Run: npx prisma db seed' })
    }

    // Check whether the approval columns exist so we can set approvalStatus correctly.
    const colCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Request' AND column_name = 'approvalStatus'
    `
    const hasApprovalColumns = colCheck.length > 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2

      try {
        const importBatchId = `${Date.now().toString().slice(-8)}-${String(i).padStart(3, '0')}`
        const requestCode = `IMP-${importBatchId}-R${String(i + 1).padStart(3, '0')}`

        const year             = safeInt(row['Year'])
        const season           = rawStr(row['Season'])         || null
        const crop             = rawStr(row['Crop'])           || null
        const program          = rawStr(row['Program'])        || null
        const sampleName       = rawStr(row['Nursery Name'])   || `Row-${rowNum}`
        const purpose          = rawStr(row['Purpose'])        || null
        const materialStage    = rawStr(row['Material Stage']) || null
        const projectCode      = rawStr(row['Project Code'])   || null
        const project          = rawStr(row['Project'])        || null
        const analysisToBeDone = rawStr(row['Analysis to be done']) || null

        const traitGene = rawStr(
          row['Trait/ Gene'] !== '' ? row['Trait/ Gene']
          : row['Trait/Gene'] !== '' ? row['Trait/Gene']
          : row['Trait / Gene']
        ) || null

        const markersPerSample    = safeInt(row['Marker per sample'])
        const markerType          = safeStr(row['Marker type'])
        const predictedSamples    = safeInt(row['Predicted Samples'])
        const predictedDataPoints = safeInt(row['Predicted data points'])
        const actualSamples       = safeInt(row['Actual Samples'])
        const actualDataPoints    = safeInt(row['Actual Data points'])

        const remarksPre  = rawStr(row['Remarks_Pre'])  || null
        const remarksPost = rawStr(row['Remarks_Post']) || null
        const notes = [remarksPre, remarksPost].filter(Boolean).join(' | ') || null

        const priorityRaw = safeInt(row['PRIORITY']) ?? 1
        const priority = priorityRaw === 1 ? 3 : priorityRaw === 3 ? 1 : 2

        const tentativeSamplingDate    = safeDate(row['Tentative sampling date'])
        const dateOfSampling           = safeDate(row['Date of Sampling'])
        const dateOfDispatch           = safeDate(row['Date of dispatch'])
        const dnaExtractionDate        = safeDate(row['DNA Extraction completion'])
        const genotypingDate           = safeDate(row['Genotyping completion'])
        const resultsCommunicationDate = safeDate(row['Results communication date'])
        const dateRequiredByBreeder    = safeDate(row['Date on or before the data is required'])

        const testType = getTestType(analysisToBeDone)
        const dodDays  = getDodDays(testType)

        const samplingBase      = dateOfSampling ?? tentativeSamplingDate ?? new Date()
        const calculatedDod     = new Date(samplingBase.getTime() + dodDays * 24 * 60 * 60 * 1000)
        const dodCommittedByLab = safeDate(row['DOD (Committed by lab)']) ?? calculatedDod
        const expectedByDate    = dateRequiredByBreeder ?? dodCommittedByLab
        const submittedAt       = dateOfSampling ?? tentativeSamplingDate ?? new Date()
        const completedAt       = resultsCommunicationDate

        const statusRaw = rawStr(
          row['STATUS'] !== '' ? row['STATUS'] : row['Status']
        ).toUpperCase()

        let status: string
        let currentPhase: string

        if (statusRaw === 'DONE' || statusRaw === 'COMPLETED') {
          status = 'COMPLETED'
          currentPhase = 'COMPLETED'
        } else if (
          statusRaw === 'IN PROGRESS' ||
          statusRaw === 'IN_PROGRESS' ||
          statusRaw === 'WIP'
        ) {
          status = 'PENDING'
          if (resultsCommunicationDate || genotypingDate) currentPhase = 'ANALYSIS'
          else if (dnaExtractionDate) currentPhase = 'GENOTYPING'
          else if (dateOfDispatch) currentPhase = 'DNA_ISOLATION'
          else currentPhase = 'SUBMITTED'
        } else {
          status = 'PENDING'
          currentPhase = 'SUBMITTED'
        }

        // FIX: imported requests represent historical data that has already been
        // processed — they should be immediately visible and workable without
        // going through the approval queue. Previously the schema default
        // 'PENDING_APPROVAL' was applied, hiding all imported records from
        // BIOTECHNOLOGIST and MANAGEMENT until a separate fix script was run.
        // We now explicitly set approvalStatus = 'APPROVED' and totalSamples so
        // that imported records behave like pre-approved requests from day one.
        const approvalData = hasApprovalColumns ? {
          approvalStatus:   'APPROVED',
          approvalPriority: 'NORMAL',
          approvedSamples:  actualSamples ?? predictedSamples ?? 0,
          totalSamples:     actualSamples ?? predictedSamples ?? 0,
          approvalDate:     submittedAt,
          queuePosition:    null,
        } : {}

        await prisma.request.create({
          data: {
            requestCode,
            submittedById:            defaultSubmitter.id,
            sampleName,
            crop,
            season,
            year,
            program,
            purpose,
            materialStage,
            project,
            projectCode,
            analysisToBeDone,
            testType,
            traitGene,
            markersPerSample,
            markerType,
            predictedSamples,
            predictedDataPoints,
            actualSamples,
            actualDataPoints,
            priority,
            notes,
            submittedAt,
            expectedByDate,
            tentativeSamplingDate,
            dateOfSampling,
            dateOfDispatch,
            dodCommittedByLab,
            dnaExtractionDate,
            genotypingDate,
            resultsCommunicationDate,
            completedAt,
            status,
            currentPhase,
            ...approvalData,
            phaseHistory: {
              create: { phase: currentPhase }
            }
          }
        })

        imported++
        console.log(
          `Row ${rowNum}: ✓ ${requestCode}` +
          ` [${testType}, DOD +${dodDays}d → ${dodCommittedByLab.toLocaleDateString()}]`
        )

      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        errors.push(`Row ${rowNum}: ${message}`)
        console.error(`Row ${rowNum}: ✗`, message)
      }
    }
  }

  // ── INVENTORY IMPORT ────────────────────────────────────────────────────────
  if (sheetType === 'inventory') {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2

      try {
        const name = rawStr(row['Material'])
        if (!name || name.toLowerCase() === 'material') {
          skipped++
          if (name) skippedDetails.push(`Row ${rowNum}: skipped header row`)
          else skippedDetails.push(`Row ${rowNum}: skipped — empty Material name`)
          continue
        }

        const catalogueNumber = rawStr(row['Catalogue Number'])
        const brand           = rawStr(row['Brand of Supply']) || null
        const type            = normaliseType(row['Type'])
        const labId           = resolveLabId(row['Lab'], targetLabId)
        const quantity        = safeQty(row['Available Quantity'])
        const unit            = rawStr(row['Unit of Qty']) || 'units'
        const mfgDate         = safeDate(row['Mfg Date'])
        const expiryDate      = safeDate(row['Expiry Date'])
        const category        = type === 'CONSUMABLE' ? 'Consumable' : 'Chemical'
        const notes           = catalogueNumber ? `Cat: ${catalogueNumber}` : null

        await prisma.inventoryItem.create({
          data: {
            name,
            brand,
            category,
            type,
            quantity,
            unit,
            minThreshold: 1,
            manufacturingDate: mfgDate,
            expiryDate,
            labId,
            notes,
          }
        })

        imported++
        console.log(`Row ${rowNum}: ✓ ${name} (${type}, qty: ${quantity} ${unit})`)

      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        errors.push(`Row ${rowNum}: ${message}`)
        console.error(`Row ${rowNum}: ✗`, message)
      }
    }
  }

  return res.status(200).json({
    imported,
    total: rows.length,
    skipped,
    skippedDetails,
    errors,
    message: `Imported ${imported} of ${rows.length} rows.${
      skipped > 0 ? ` ${skipped} skipped.` : ''
    }${errors.length > 0 ? ` ${errors.length} errors.` : ''}`
  })
}