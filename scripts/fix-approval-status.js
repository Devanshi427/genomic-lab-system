// scripts/fix-approval-status.js

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()


const APPROVAL_SYSTEM_GO_LIVE = new Date('2026-06-02T07:03:40Z')

async function main() {
  console.log('🔧 Fixing approval status for existing requests...\n')
  console.log(`   Legacy cutoff: all requests submitted before ${APPROVAL_SYSTEM_GO_LIVE.toISOString()}\n`)

  // Check column exists first
  const colCheck = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Request' AND column_name = 'approvalStatus'
  `
  if (colCheck.length === 0) {
    console.log('❌ approvalStatus column not found. Run the migration first.')
    return
  }

  // Fix 1: All COMPLETED requests → APPROVED
  const r1 = await prisma.$executeRaw`
    UPDATE "Request"
    SET
      "approvalStatus"  = 'APPROVED',
      "approvedSamples" = COALESCE("predictedSamples", "actualSamples", 0),
      "totalSamples"    = COALESCE("predictedSamples", "actualSamples", 0),
      "approvalDate"    = COALESCE("completedAt", "submittedAt"),
      "queuePosition"   = NULL
    WHERE "status" = 'COMPLETED'
      AND "approvalStatus" = 'PENDING_APPROVAL'
  `
  console.log(`✅ Completed requests fixed: ${r1}`)

  // Fix 2: PENDING/IN_PROGRESS requests already past SUBMITTED phase → APPROVED
  // These were already in the lab before the approval system existed.
  const r2 = await prisma.$executeRaw`
    UPDATE "Request"
    SET
      "approvalStatus"  = 'APPROVED',
      "approvedSamples" = COALESCE("predictedSamples", "actualSamples", 0),
      "totalSamples"    = COALESCE("predictedSamples", "actualSamples", 0),
      "approvalDate"    = "submittedAt",
      "queuePosition"   = NULL
    WHERE "status" IN ('PENDING', 'IN_PROGRESS')
      AND "currentPhase" != 'SUBMITTED'
      AND "approvalStatus" = 'PENDING_APPROVAL'
  `
  console.log(`✅ In-progress requests fixed: ${r2}`)

  // Fix 3: Remaining PENDING_APPROVAL requests submitted BEFORE the approval
  // system went live → approve as legacy.
  // FIX: Previously used "submitted > 2 hours ago" which would auto-approve
  // any legitimately pending request if this script was re-run.
  // Now uses a hard cutoff date so only pre-system records are affected.
  const r3 = await prisma.$executeRaw`
    UPDATE "Request"
    SET
      "approvalStatus"  = 'APPROVED',
      "approvedSamples" = COALESCE("predictedSamples", "actualSamples", 0),
      "totalSamples"    = COALESCE("predictedSamples", "actualSamples", 0),
      "approvalDate"    = "submittedAt",
      "queuePosition"   = NULL
    WHERE "approvalStatus" = 'PENDING_APPROVAL'
      AND "submittedAt" < ${APPROVAL_SYSTEM_GO_LIVE}
  `
  console.log(`✅ Legacy pre-system requests fixed: ${r3}`)

  // Fix 4: Backfill totalSamples on all approved requests
  const r4 = await prisma.$executeRaw`
    UPDATE "Request"
    SET "totalSamples" = COALESCE("predictedSamples", "actualSamples", 0)
    WHERE "approvalStatus" = 'APPROVED'
      AND "totalSamples" IS NULL
  `
  console.log(`✅ totalSamples backfilled: ${r4}`)

  // Show final counts
  const counts = await prisma.$queryRaw`
    SELECT "approvalStatus", COUNT(*)::int AS count
    FROM "Request"
    GROUP BY "approvalStatus"
    ORDER BY "approvalStatus"
  `
  console.log('\n📊 Final counts:')
  for (const row of counts) {
    console.log(`   ${row.approvalStatus}: ${row.count}`)
  }

  console.log('\n✨ Done! Refresh your Approvals page.')
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())