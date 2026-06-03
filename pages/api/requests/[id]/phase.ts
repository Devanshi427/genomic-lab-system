// pages/api/requests/[id]/phase.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
import { writeAudit } from '../../../../lib/audit'
import { sendPhaseEmail } from '../../../../lib/email'

declare const global: { io?: { to: (room: string) => { emit: (event: string, data: unknown) => void } } }

const PHASES_15DAY = ['SUBMITTED', 'RECEIVED', 'DNA_ISOLATION', 'GENOTYPING', 'ANALYSIS', 'COMPLETED']
const PHASES_30DAY = ['SUBMITTED', 'RECEIVED', 'DNA_ISOLATION', 'GENOTYPING', 'ANALYSIS', 'COMPLETED']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Not authenticated' })

  const user = session.user as { id: string; role: string }

  if (user.role !== 'BIOTECHNOLOGIST' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Not authorised to advance phases' })
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const requestId = parseInt(req.query.id as string)
  if (isNaN(requestId)) {
    return res.status(400).json({ error: 'Invalid request ID' })
  }

  const { notes } = req.body

  const existingRequest = await prisma.request.findUnique({
    where: { id: requestId }
  })

  if (!existingRequest) {
    return res.status(404).json({ error: 'Request not found' })
  }

  if (existingRequest.status === 'COMPLETED') {
    return res.status(400).json({ error: 'Request is already completed' })
  }


  try {
    const colCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Request' AND column_name = 'approvalStatus'
    `
    if (colCheck.length > 0) {
      const approvalStatus = (existingRequest as Record<string, unknown>).approvalStatus as string | undefined
      const nonLabStatuses = ['PENDING_APPROVAL', 'PARTIALLY_REJECTED', 'REJECTED']
      if (approvalStatus && nonLabStatuses.includes(approvalStatus)) {
        return res.status(400).json({
          error: `Request has not been approved for lab processing (current approval status: ${approvalStatus}). Please approve the request via the Approvals queue first.`,
        })
      }
    }
  } catch {
    // approvalStatus column does not exist — legacy mode, allow advancement
  }

  const phases = existingRequest.testType === '30-DAY' ? PHASES_30DAY : PHASES_15DAY
  const currentIndex = phases.indexOf(existingRequest.currentPhase)

  if (currentIndex === -1) {
    return res.status(400).json({ error: 'Unknown current phase' })
  }

  if (currentIndex === phases.length - 1) {
    return res.status(400).json({ error: 'Already at final phase' })
  }

  const nextPhase = phases[currentIndex + 1]
  const isCompleting = nextPhase === 'COMPLETED'

  const now = new Date()

  // Phase → date column mapping.
  // Each entry records the timestamp when that phase was ENTERED.
  //   RECEIVED:      dateOfSampling  — samples received in the lab
  //   DNA_ISOLATION: dateOfDispatch  — samples dispatched to extraction
  //   GENOTYPING:    dnaExtractionDate — extraction complete, genotyping starts
  //   ANALYSIS:      genotypingDate  — genotyping complete, analysis starts
  //   COMPLETED:     resultsCommunicationDate — results communicated
  const phaseDateField: Partial<Record<string, string>> = {
    RECEIVED:      'dateOfSampling',
    DNA_ISOLATION: 'dateOfDispatch',
    GENOTYPING:    'dnaExtractionDate',
    ANALYSIS:      'genotypingDate',
    COMPLETED:     'resultsCommunicationDate',
  }

  const dateFieldToSet = phaseDateField[nextPhase]

  // Only set the date field if it is currently null — never overwrite a
  // manually entered or imported date.
  const extraDateData: Record<string, Date> = {}
  if (dateFieldToSet) {
    const existing = (existingRequest as Record<string, unknown>)[dateFieldToSet]
    if (!existing) {
      extraDateData[dateFieldToSet] = now
    }
  }

  // Stamp dodCommittedByLab when entering DNA_ISOLATION if not already set.
  if (nextPhase === 'DNA_ISOLATION' && !existingRequest.dodCommittedByLab) {
    const dodDays = existingRequest.testType === '30-DAY' ? 30 : 15
    const base = existingRequest.dateOfSampling ?? now
    extraDateData.dodCommittedByLab = new Date(
      base.getTime() + dodDays * 24 * 60 * 60 * 1000
    )
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: {
      currentPhase: nextPhase,
      status: isCompleting ? 'COMPLETED' : 'IN_PROGRESS',
      completedAt: isCompleting ? now : undefined,
      ...extraDateData,
      phaseHistory: {
        create: {
          phase: nextPhase,
          notes: notes ?? '',
          startedAt: now,
        }
      }
    }
  })

  await writeAudit({
    action:        'PHASE_ADVANCED',
    entityType:    'Request',
    entityId:      requestId,
    detail:        `Advanced to ${nextPhase}`,
    performedById: parseInt(user.id),
  })

  if (global.io) {
    global.io.to('INVENTORY_MANAGER').emit('notification', {
      type: 'info',
      message: `Request ${updated.requestCode} advanced to ${nextPhase.replace(/_/g, ' ')}`,
    })
    global.io.to('BIOTECHNOLOGIST').emit('notification', {
      type: 'success',
      message: `Phase updated: ${updated.requestCode} is now ${nextPhase.replace(/_/g, ' ')}`,
    })
  }

  try {
    const breeder = await prisma.user.findUnique({
      where: { id: updated.submittedById },
      select: { name: true, email: true }
    })

    if (breeder?.email) {
      await sendPhaseEmail({
        toEmail:        breeder.email,
        toName:         breeder.name ?? 'Researcher',
        requestCode:    updated.requestCode,
        sampleName:     updated.sampleName,
        newPhase:       nextPhase,
        expectedByDate: new Date(updated.expectedByDate).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric'
        }),
      })
    }
  } catch (emailErr) {
    console.error('[Email] Failed to send phase notification:', emailErr)
  }

  return res.status(200).json(updated)
}