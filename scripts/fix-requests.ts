// scripts/fix-requests.ts
// Run with: npx ts-node scripts/fix-requests.ts
//
// What this does:
//   1. Reads the data from the array below (copied from your Excel)
//   2. Finds each Request by projectCode
//   3. Updates: actualDataPoints, markerType, predictedDataPoints,
//      markersPerSample, predictedSamples, actualSamples
//
// Run AFTER adding markerType + predictedDataPoints to your schema:
//   npx prisma migrate dev --name add_marker_type_predicted_data_points

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Data from your Excel (projectCode → fields to update) ───────────────────
// Columns: projectCode, markersPerSample, markerType, predictedSamples,
//          predictedDataPoints, actualSamples, actualDataPoints
const DATA: Array<{
  projectCode: string
  markersPerSample: number | null
  markerType: string | null
  predictedSamples: number | null
  predictedDataPoints: number | null
  actualSamples: number | null
  actualDataPoints: number | null
}> = [
  { projectCode: 'IRHC003',          markersPerSample: 12,  markerType: 'SNP', predictedSamples: 4723,  predictedDataPoints: 56676, actualSamples: 3131, actualDataPoints: 37572 },
  { projectCode: 'IRHC004',          markersPerSample: 12,  markerType: 'SNP', predictedSamples: 1491,  predictedDataPoints: 17892, actualSamples: 1112, actualDataPoints: 13344 },
  { projectCode: 'IRHC005',          markersPerSample: 12,  markerType: 'SNP', predictedSamples: 494,   predictedDataPoints: 5928,  actualSamples: 343,  actualDataPoints: 4116  },
  { projectCode: 'IRTI024-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 6,    actualDataPoints: 12    },
  { projectCode: 'IRTI025-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 52,   actualDataPoints: 104   },
  { projectCode: 'IRTI026-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 173,  actualDataPoints: 346   },
  { projectCode: 'IRTI027-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 144,  actualDataPoints: 288   },
  { projectCode: 'IRTI028-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 134,  actualDataPoints: 268   },
  { projectCode: 'IRTI029-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 30,   actualDataPoints: 60    },
  { projectCode: 'IRTI030-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 26,   actualDataPoints: 52    },
  { projectCode: 'IRTI031-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 132,  actualDataPoints: 264   },
  { projectCode: 'IRTI032-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 172,  actualDataPoints: 344   },
  { projectCode: 'IRTI033-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 52,   actualDataPoints: 104   },
  { projectCode: 'IRTI034-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 160,  actualDataPoints: 320   },
  { projectCode: 'IRTI035-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 291,  actualDataPoints: 582   },
  { projectCode: 'IRTI036-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 235,  actualDataPoints: 470   },
  { projectCode: 'IRTI037-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 109,  actualDataPoints: 218   },
  { projectCode: 'IRTI038-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 49,   actualDataPoints: 98    },
  { projectCode: 'IRTI039-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 15,   actualDataPoints: 30    },
  { projectCode: 'IRTI040-C4',       markersPerSample: 2,   markerType: 'SSR', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 69,   actualDataPoints: 138   },
  { projectCode: 'IRTI018-C1',       markersPerSample: 3,   markerType: 'SNP', predictedSamples: 1917,  predictedDataPoints: 5751,  actualSamples: 1645, actualDataPoints: 4935  },
  { projectCode: 'IRTI019-C0',       markersPerSample: 3,   markerType: 'SNP', predictedSamples: 1260,  predictedDataPoints: 3780,  actualSamples: 1152, actualDataPoints: 3456  },
  { projectCode: 'IRTI020-C3',       markersPerSample: 3,   markerType: 'SNP', predictedSamples: 1963,  predictedDataPoints: 5889,  actualSamples: 941,  actualDataPoints: 2823  },
  { projectCode: 'IRTI021-C2',       markersPerSample: 3,   markerType: 'SNP', predictedSamples: 1020,  predictedDataPoints: 3060,  actualSamples: 997,  actualDataPoints: 2991  },
  { projectCode: 'IRHC001',          markersPerSample: 2,   markerType: 'SNP', predictedSamples: 285,   predictedDataPoints: 570,   actualSamples: 239,  actualDataPoints: 478   },
  { projectCode: 'IRTI001-C7',       markersPerSample: 3,   markerType: 'SNP', predictedSamples: 204,   predictedDataPoints: 612,   actualSamples: 144,  actualDataPoints: 432   },
  { projectCode: 'IRTI002-C6',       markersPerSample: 3,   markerType: 'SNP', predictedSamples: 60,    predictedDataPoints: 180,   actualSamples: 40,   actualDataPoints: 120   },
  { projectCode: 'IRTI003-C6',       markersPerSample: 3,   markerType: 'SNP', predictedSamples: 36,    predictedDataPoints: 108,   actualSamples: 19,   actualDataPoints: 57    },
  { projectCode: 'IRTI015-C4.2',     markersPerSample: 3,   markerType: 'SNP', predictedSamples: 10000, predictedDataPoints: 30000, actualSamples: 1430, actualDataPoints: 4290  },
  { projectCode: 'IRTI016-C4.3',     markersPerSample: 3,   markerType: 'SNP', predictedSamples: 190,   predictedDataPoints: 570,   actualSamples: 185,  actualDataPoints: 555   },
  { projectCode: 'IRTI017-C4.4',     markersPerSample: 3,   markerType: 'SNP', predictedSamples: 65,    predictedDataPoints: 195,   actualSamples: 65,   actualDataPoints: 195   },
  { projectCode: 'IRTI018-C4.6',     markersPerSample: 3,   markerType: 'SNP', predictedSamples: 145,   predictedDataPoints: 435,   actualSamples: 145,  actualDataPoints: 435   },
  { projectCode: 'IRHC002',          markersPerSample: 1,   markerType: 'SNP', predictedSamples: 111,   predictedDataPoints: 111,   actualSamples: 67,   actualDataPoints: 67    },
  { projectCode: 'IRTI004-C3',       markersPerSample: 3,   markerType: 'SNP', predictedSamples: 170,   predictedDataPoints: 510,   actualSamples: 170,  actualDataPoints: 510   },
  { projectCode: 'IRTI005-C6',       markersPerSample: 3,   markerType: 'SNP', predictedSamples: 31,    predictedDataPoints: 93,    actualSamples: 31,   actualDataPoints: 93    },
  { projectCode: 'IRTI006-C3',       markersPerSample: 3,   markerType: 'SNP', predictedSamples: 493,   predictedDataPoints: 1479,  actualSamples: 493,  actualDataPoints: 1479  },
  { projectCode: 'IRTI007-C2',       markersPerSample: 3,   markerType: 'SNP', predictedSamples: 261,   predictedDataPoints: 783,   actualSamples: 376,  actualDataPoints: 1128  },
  { projectCode: 'IRTI012-C5.2',     markersPerSample: 3,   markerType: 'SNP', predictedSamples: 8750,  predictedDataPoints: 26250, actualSamples: 2191, actualDataPoints: 6573  },
  { projectCode: 'IRTI013-C4.3',     markersPerSample: 3,   markerType: 'SNP', predictedSamples: 280,   predictedDataPoints: 840,   actualSamples: 280,  actualDataPoints: 840   },
  { projectCode: 'IRTI014-C4.3',     markersPerSample: 3,   markerType: 'SNP', predictedSamples: 200,   predictedDataPoints: 600,   actualSamples: 200,  actualDataPoints: 600   },
  { projectCode: 'IRTI008-C4.6',     markersPerSample: 3,   markerType: 'SNP', predictedSamples: 210,   predictedDataPoints: 630,   actualSamples: 210,  actualDataPoints: 630   },
  { projectCode: 'IRTI009-C4.4',     markersPerSample: 3,   markerType: 'SNP', predictedSamples: 175,   predictedDataPoints: 525,   actualSamples: 175,  actualDataPoints: 525   },
  { projectCode: 'IRTI010-C4.7',     markersPerSample: 3,   markerType: 'SNP', predictedSamples: 195,   predictedDataPoints: 585,   actualSamples: 195,  actualDataPoints: 585   },
  { projectCode: 'IRTI011-C4.3',     markersPerSample: 3,   markerType: 'SNP', predictedSamples: 250,   predictedDataPoints: 750,   actualSamples: 250,  actualDataPoints: 750   },
  { projectCode: 'IRTP001',          markersPerSample: 12,  markerType: 'SNP', predictedSamples: 3600,  predictedDataPoints: 43200, actualSamples: 3389, actualDataPoints: 40668 },
  { projectCode: 'IRPA001',          markersPerSample: 8,   markerType: 'SNP', predictedSamples: 3600,  predictedDataPoints: 28800, actualSamples: 3258, actualDataPoints: 26064 },
  { projectCode: 'IRTP002',          markersPerSample: 9,   markerType: 'SNP', predictedSamples: 1800,  predictedDataPoints: 16200, actualSamples: 1541, actualDataPoints: 13869 },
  { projectCode: 'IRTP003',          markersPerSample: 3,   markerType: 'SNP', predictedSamples: 8250,  predictedDataPoints: 24750, actualSamples: 4302, actualDataPoints: 12906 },
  { projectCode: 'ICTP001',          markersPerSample: 2,   markerType: 'SNP', predictedSamples: 2200,  predictedDataPoints: 4400,  actualSamples: 256,  actualDataPoints: 512   },
  { projectCode: 'ICTP002',          markersPerSample: 2,   markerType: 'SNP', predictedSamples: 4000,  predictedDataPoints: 8000,  actualSamples: 1333, actualDataPoints: 2666  },
  { projectCode: 'ICTP003',          markersPerSample: 2,   markerType: 'SNP', predictedSamples: 4400,  predictedDataPoints: 8800,  actualSamples: 1097, actualDataPoints: 2194  },
  { projectCode: 'ICTP004',          markersPerSample: 2,   markerType: 'SNP', predictedSamples: 2180,  predictedDataPoints: 4360,  actualSamples: 2180, actualDataPoints: 4360  },
  { projectCode: 'ICTP005',          markersPerSample: 2,   markerType: 'SNP', predictedSamples: 150,   predictedDataPoints: 300,   actualSamples: 150,  actualDataPoints: 300   },
  // Background rows (IRTI001-C7 and IRTI004-C3 appear twice with different analysis — handled below)
  // Note: ICTP001 appears twice (T2 HSP and T1 HSP) — update both via requestCode if needed
]

// ── Rows that have duplicate projectCodes (Background analysis entries) ──────
// These share a projectCode with a Foreground entry. We update ALL matching records.
const BACKGROUND_DATA: Array<{
  projectCode: string
  markersPerSample: number | null
  markerType: string | null
  predictedSamples: number | null
  predictedDataPoints: number | null
  actualSamples: number | null
  actualDataPoints: number | null
  analysisToBeDone: string
}> = [
  { projectCode: 'IRTI001-C7', analysisToBeDone: 'Background', markersPerSample: 84, markerType: 'SNP', predictedSamples: 28,  predictedDataPoints: 2352, actualSamples: 23, actualDataPoints: 1932 },
  { projectCode: 'IRTI004-C3', analysisToBeDone: 'Background', markersPerSample: 95, markerType: 'SNP', predictedSamples: 25,  predictedDataPoints: 2375, actualSamples: 17, actualDataPoints: 1615 },
  { projectCode: 'IRTI006-C3', analysisToBeDone: 'Background', markersPerSample: 103, markerType: 'SNP', predictedSamples: 65, predictedDataPoints: 6695, actualSamples: 64, actualDataPoints: 6592 },
  // IRTP001 Foreground (BLB genes, 4 markers) — different from Purity_Analysis entry
  { projectCode: 'IRTP001', analysisToBeDone: 'Foreground', markersPerSample: 4, markerType: 'SNP', predictedSamples: 3600, predictedDataPoints: 14400, actualSamples: 3404, actualDataPoints: 13616 },
  { projectCode: 'IRTP002', analysisToBeDone: 'Foreground', markersPerSample: 3, markerType: 'SNP', predictedSamples: 1800, predictedDataPoints: 5400,  actualSamples: 1484, actualDataPoints: 4452  },
  // ICTP001 T1 HSP (different actual samples)
  { projectCode: 'ICTP001', analysisToBeDone: 'Foreground', markersPerSample: 2, markerType: 'SNP', predictedSamples: 3500, predictedDataPoints: 7000, actualSamples: 1131, actualDataPoints: 2262 },
]

async function main() {
  console.log('Starting fix-requests script...\n')
  let updated = 0
  let notFound = 0

  // ── Update standard rows (unique projectCode) ─────────────────────────────
  for (const row of DATA) {
    const code = row.projectCode.trim()
    try {
      const result = await prisma.request.updateMany({
        where: { projectCode: { equals: code, mode: 'insensitive' } },
        data: {
          markersPerSample:    row.markersPerSample,
          markerType:          row.markerType,
          predictedSamples:    row.predictedSamples,
          predictedDataPoints: row.predictedDataPoints,
          actualSamples:       row.actualSamples,
          actualDataPoints:    row.actualDataPoints,
        },
      })
      if (result.count === 0) {
        console.warn(`  ⚠ NOT FOUND: ${code}`)
        notFound++
      } else {
        console.log(`  ✓ ${code} — updated ${result.count} record(s)`)
        updated += result.count
      }
    } catch (err) {
      console.error(`  ✗ ERROR for ${code}:`, err)
    }
  }

  // ── Update background/duplicate rows (match by projectCode + analysis) ────
  for (const row of BACKGROUND_DATA) {
    const code = row.projectCode.trim()
    try {
      const result = await prisma.request.updateMany({
        where: {
          projectCode:     { equals: code, mode: 'insensitive' },
          analysisToBeDone: { contains: row.analysisToBeDone, mode: 'insensitive' },
        },
        data: {
          markersPerSample:    row.markersPerSample,
          markerType:          row.markerType,
          predictedSamples:    row.predictedSamples,
          predictedDataPoints: row.predictedDataPoints,
          actualSamples:       row.actualSamples,
          actualDataPoints:    row.actualDataPoints,
        },
      })
      if (result.count === 0) {
        console.warn(`  ⚠ NOT FOUND: ${code} (${row.analysisToBeDone})`)
        notFound++
      } else {
        console.log(`  ✓ ${code} (${row.analysisToBeDone}) — updated ${result.count} record(s)`)
        updated += result.count
      }
    } catch (err) {
      console.error(`  ✗ ERROR for ${code}:`, err)
    }
  }

  console.log(`\nDone. Updated: ${updated} | Not found: ${notFound}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())