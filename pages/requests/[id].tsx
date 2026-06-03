//pages/requests/[id].tsx
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

// ─── Types ────────────────────────────────────────────────────────────────────

type PhaseHistory = {
  id: number
  phase: string
  notes: string | null
  startedAt: string
}

type ReagentLog = {
  id: number
  quantityUsed: number
  purpose: string
  usedAt: string
  item: { name: string; unit: string }
  usedBy: { name: string }
}

type RequestDetail = {
  id: number
  requestCode: string
  sampleName: string
  crop: string | null
  season: string | null
  year: number | null
  program: string | null
  purpose: string | null
  materialStage: string | null
  project: string | null
  projectCode: string | null
  testType: string
  analysisToBeDone: string | null
  traitGene: string | null
  markersPerSample: number | null
  markerType: string | null
  snpCount: number | null
  ssrCount: number | null
  predictedSamples: number | null
  predictedDataPoints: number | null
  actualSamples: number | null
  actualDataPoints: number | null
  priority: number
  status: string
  currentPhase: string
  notes: string | null
  submittedAt: string
  expectedByDate: string
  tentativeSamplingDate: string | null
  dateOfSampling: string | null
  dateOfDispatch: string | null
  completedAt: string | null
  submittedBy: { name: string; email: string }
  assignedLab: { name: string } | null
  phaseHistory: PhaseHistory[]
  reagentLogs: ReagentLog[]
  submittedById: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASES = ['SUBMITTED', 'RECEIVED', 'DNA_ISOLATION', 'GENOTYPING', 'ANALYSIS', 'COMPLETED']

const PHASE_LABELS: Record<string, string> = {
  SUBMITTED:     'Submitted',
  RECEIVED:      'Received',
  DNA_ISOLATION: 'DNA Isolation',
  GENOTYPING:    'Genotyping',
  ANALYSIS:      'Analysis',
  COMPLETED:     'Completed',
}

const PHASE_BADGE: Record<string, { bg: string; color: string }> = {
  SUBMITTED:     { bg: 'rgba(219,234,254,0.8)', color: '#1d4ed8' },
  RECEIVED:      { bg: 'rgba(224,242,254,0.8)', color: '#0369a1' },
  DNA_ISOLATION: { bg: 'rgba(254,243,199,0.8)', color: '#92400e' },
  GENOTYPING:    { bg: 'rgba(243,232,255,0.8)', color: '#6d28d9' },
  ANALYSIS:      { bg: 'rgba(255,237,213,0.8)', color: '#c2410c' },
  COMPLETED:     { bg: 'rgba(209,250,229,0.8)', color: '#065f46' },
  CANCELLED:     { bg: 'rgba(254,226,226,0.8)', color: '#991b1b' },
}


const MARKER_TYPE_OPTIONS = ['SNP', 'SSR', 'BOTH']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function toInputDate(d: string | null | undefined) {
  if (!d) return ''
  return new Date(d).toISOString().split('T')[0]
}

/**
 * Derives PREDICTED SNP and SSR counts from markerType + predictedSamples.
 *   SNP  → snp = samples, ssr = 0
 *   SSR  → snp = 0,       ssr = samples
 *   BOTH → snp = stored snpCount (manual split), ssr = stored ssrCount
 *          Falls back to samples if not yet saved.
 */
function derivePredictedSnpSsr(
  markerType: string | null,
  samples: number | null,
  snpCount: number | null,
  ssrCount: number | null,
): { snp: number; ssr: number } {
  const n  = samples ?? 0
  const mt = (markerType ?? '').toUpperCase().trim()
  if (mt === 'SNP')  return { snp: n, ssr: 0 }
  if (mt === 'SSR')  return { snp: 0, ssr: n }
  // BOTH: use the stored split (snpCount/ssrCount), fall back to n if not yet set
  if (mt === 'BOTH') return { snp: snpCount ?? n, ssr: ssrCount ?? n }
  return { snp: 0, ssr: 0 }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconBack = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
)

const IconInfo = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
  </svg>
)

const IconEdit = () => (
  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
  </svg>
)

const IconPhase = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
)

const IconHistory = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const IconReagent = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
  </svg>
)

const IconSpinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
    style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>
    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity={0.25} />
    <path d="M21 12a9 9 0 00-9-9" strokeLinecap="round" />
  </svg>
)

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ icon, title, accent, children, headerRight }: {
  icon: React.ReactNode
  title: string
  accent?: string
  children: React.ReactNode
  headerRight?: React.ReactNode
}) {
  const color = accent || '#059669'
  return (
    <div style={{
      background: 'rgba(255,255,255,0.75)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.5)',
      borderRadius: 20,
      boxShadow: '0 8px 30px rgba(15,23,42,0.05)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 24px',
        borderBottom: '1px solid rgba(241,245,249,0.9)',
        background: 'rgba(248,250,252,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 34, height: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${color}18, ${color}10)`,
            borderRadius: 10, color,
          }}>
            {icon}
          </span>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.01em' }}>
            {title}
          </h2>
        </div>
        {headerRight}
      </div>
      <div style={{ padding: '24px' }}>
        {children}
      </div>
    </div>
  )
}

function DataGrid({ items }: { items: [string, string | null | undefined][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 32px' }}>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            {label}
          </dt>
          <dd style={{ fontSize: 14, color: value ? '#1e293b' : '#cbd5e1', fontWeight: value ? 600 : 400, margin: 0 }}>
            {value || '—'}
          </dd>
        </div>
      ))}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #e2e8f0', borderRadius: 10,
  padding: '9px 12px', fontSize: 13, color: '#1e293b',
  background: 'rgba(255,255,255,0.8)',
  outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
}

const readonlyInputStyle: React.CSSProperties = {
  ...inputStyle,
  background: 'rgba(248,250,252,0.8)',
  color: '#64748b',
  cursor: 'not-allowed',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.07em', marginBottom: 6,
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RequestDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id } = router.query

  const [req, setReq]             = useState<RequestDetail | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [advancing, setAdvancing] = useState(false)
  const [editingPart2, setEditingPart2] = useState(false)
  const [savingPart2, setSavingPart2]   = useState(false)
  const [part2Error, setPart2Error]     = useState('')
  const [part2Success, setPart2Success] = useState(false)

  const [part2Form, setPart2Form] = useState({
    analysisToBeDone: '',
    tentativeSamplingDate: '',
    priority: '1',
    expectedByDate: '',
    notes: '',
    actualSamples: '',
    actualDataPoints: '',
    dateOfSampling: '',
    dateOfDispatch: '',
    // Marker Type — editable in Additional Details when not set in Request Details
    markerType: '',
    // BOTH only — manually entered, must sum to actualSamples
    snpCount: '',
    ssrCount: '',
  })

  const role   = (session?.user as Record<string, unknown>)?.role   as string
  const userId = (session?.user as Record<string, unknown>)?.id     as string

  const canAdvance     = role === 'BIOTECHNOLOGIST' || role === 'ADMIN'
  const canSeeReagents = role === 'BIOTECHNOLOGIST' || role === 'INVENTORY_MANAGER' || role === 'ADMIN'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const load = useCallback(() => {
    if (!id) return
    fetch(`/api/requests/${id}`)
      .then(r => { if (!r.ok) throw new Error('Request not found'); return r.json() })
      .then((data: RequestDetail) => {
        setReq(data)
        setLoading(false)
        setPart2Form({
          analysisToBeDone:      data.analysisToBeDone      ?? '',
          tentativeSamplingDate: toInputDate(data.tentativeSamplingDate),
          priority:              String(data.priority ?? 1),
          expectedByDate:        toInputDate(data.expectedByDate),
          notes:                 data.notes                 ?? '',
          actualSamples:         data.actualSamples    != null ? String(data.actualSamples)    : '',
          actualDataPoints:      data.actualDataPoints  != null ? String(data.actualDataPoints) : '',
          dateOfSampling:        toInputDate(data.dateOfSampling),
          dateOfDispatch:        toInputDate(data.dateOfDispatch),
          markerType:            data.markerType ?? '',
          snpCount:              data.snpCount  != null ? String(data.snpCount)  : '',
          ssrCount:              data.ssrCount  != null ? String(data.ssrCount)  : '',
        })
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [id])

  useEffect(() => { if (session && id) load() }, [session, id, load])

  const canEditPart2 =
    role === 'ADMIN' || role === 'BIOTECHNOLOGIST' ||
    (role === 'BREEDER' && req?.submittedById === parseInt(userId))

  async function handleAdvance() {
    if (!req) return
    const currentIndex = PHASES.indexOf(req.currentPhase)
    const nextPhase    = PHASES[currentIndex + 1]
    if (!nextPhase) return
    if (!window.confirm(`Advance to: ${PHASE_LABELS[nextPhase]}?`)) return
    setAdvancing(true)
    try {
      const res = await fetch(`/api/requests/${req.id}/phase`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: '' }),
      })
      if (!res.ok) throw new Error('Failed to advance phase')
      load()
    } catch { alert('Could not advance phase. Please try again.') }
    finally { setAdvancing(false) }
  }

  async function handleSavePart2(e: React.FormEvent) {
    e.preventDefault()
    setPart2Error(''); setPart2Success(false)

    // The effective marker type: from req if already set, otherwise from the form
    const effectiveMarkerType = (req?.markerType ?? part2Form.markerType).toUpperCase().trim()

    // ── Validate BOTH: snp + ssr must equal actualSamples ──────────────────
    if (effectiveMarkerType === 'BOTH') {
      const actual = parseFloat(part2Form.actualSamples)
      const snp    = parseFloat(part2Form.snpCount)
      const ssr    = parseFloat(part2Form.ssrCount)
      if (!isNaN(actual) && !isNaN(snp) && !isNaN(ssr)) {
        if (snp + ssr !== actual) {
          setPart2Error(
            `No. of SNP (${snp}) + No. of SSR (${ssr}) must equal Actual Samples (${actual}). Currently sums to ${snp + ssr}.`
          )
          return
        }
      }
    }

    setSavingPart2(true)
    try {
      const res = await fetch(`/api/requests/${req!.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(part2Form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setPart2Success(true); setEditingPart2(false); load()
      setTimeout(() => setPart2Success(false), 3000)
    } catch (e: unknown) {
      setPart2Error(e instanceof Error ? e.message : 'Unknown error')
    } finally { setSavingPart2(false) }
  }

  if (status === 'loading' || loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
      <div style={{ textAlign: 'center' }}>
        <IconSpinner />
        <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 12 }}>Loading request...</p>
      </div>
    </div>
  )

  if (error || !req) return (
    <div style={{ padding: 32 }}>
      <div style={{
        background: 'rgba(254,242,242,0.9)', border: '1px solid rgba(252,165,165,0.5)',
        borderRadius: 14, padding: '16px 20px', color: '#b91c1c', fontSize: 14,
      }}>
        {error || 'Request not found'}
      </div>
      <button onClick={() => router.push('/requests')}
        style={{ marginTop: 16, color: '#059669', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>
        ← Back to requests
      </button>
    </div>
  )

  // ── req is non-null past this point ──────────────────────────────────────
  const r = req

  const currentIndex = PHASES.indexOf(r.currentPhase)
  const nextPhase    = PHASES[currentIndex + 1]

  const badgePhase = r.status === 'CANCELLED' ? 'CANCELLED' : r.currentPhase
  const sc = PHASE_BADGE[badgePhase] ?? { bg: 'rgba(241,245,249,0.8)', color: '#475569' }
  const scLabel = r.status === 'CANCELLED'
    ? 'Cancelled'
    : (PHASE_LABELS[r.currentPhase] ?? r.currentPhase)

  // ── Predicted SNP/SSR (Request Details — read-only display) ───────────────
  //   SNP  → snp = predictedSamples, ssr = 0
  //   SSR  → snp = 0,                ssr = predictedSamples
  //   BOTH → snp = stored snpCount,  ssr = stored ssrCount  (manual split)
  const predDerived = derivePredictedSnpSsr(r.markerType, r.predictedSamples, r.snpCount, r.ssrCount)

  // ── Effective marker type for the edit form ───────────────────────────────
  // Locked to req.markerType if already set; otherwise user can select in form.
  const formMarkerType     = r.markerType ?? part2Form.markerType
  const isBoth             = formMarkerType.toUpperCase() === 'BOTH'
  const markerTypeIsLocked = !!r.markerType

  // ── Live sum feedback for BOTH validation in edit mode ────────────────────
  const formActualSamples = part2Form.actualSamples !== '' ? parseFloat(part2Form.actualSamples) : null
  const formSnp           = part2Form.snpCount      !== '' ? parseFloat(part2Form.snpCount)      : null
  const formSsr           = part2Form.ssrCount      !== '' ? parseFloat(part2Form.ssrCount)      : null
  const formBothSum       = (formSnp ?? 0) + (formSsr ?? 0)
  const formBothValid     =
    formActualSamples !== null && formSnp !== null && formSsr !== null
      ? formBothSum === formActualSamples
      : true   // don't show error until all three are filled

  // ── Read-only actual SNP/SSR display helpers ──────────────────────────────
  //   SNP  → snp = actualSamples (auto), ssr = 0 (auto)
  //   SSR  → snp = 0 (auto),             ssr = actualSamples (auto)
  //   BOTH → snp = stored snpCount,       ssr = stored ssrCount  (manual split)
  function readonlySnpDisplay(): string {
    if (!r.markerType) return '—'
    const mt = r.markerType.toUpperCase()
    if (mt === 'SNP')  return r.actualSamples != null ? String(r.actualSamples) : '—'
    if (mt === 'SSR')  return '0'
    if (mt === 'BOTH') return r.snpCount != null ? String(r.snpCount) : '—'
    return '—'
  }

  function readonlySsrDisplay(): string {
    if (!r.markerType) return '—'
    const mt = r.markerType.toUpperCase()
    if (mt === 'SNP')  return '0'
    if (mt === 'SSR')  return r.actualSamples != null ? String(r.actualSamples) : '—'
    if (mt === 'BOTH') return r.ssrCount != null ? String(r.ssrCount) : '—'
    return '—'
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        input:focus, select:focus, textarea:focus {
          border-color: #10b981 !important;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.12) !important;
        }
      `}</style>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 48px' }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={() => router.push('/requests')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 500, color: '#64748b',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 0', marginBottom: 16, transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#0f172a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
          >
            <IconBack /> Back to Requests
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h1 style={{
                  fontSize: 28, fontWeight: 900, color: '#0f172a',
                  letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1,
                }}>
                  {r.projectCode ?? r.sampleName}
                </h1>
                <span style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: sc.bg, color: sc.color,
                }}>
                  {scLabel}
                </span>
              </div>
              <p style={{ fontSize: 14, color: '#64748b', marginTop: 6, marginBottom: 0 }}>
                {r.sampleName} · Submitted by {r.submittedBy.name} · {fmt(r.submittedAt)}
              </p>
            </div>

            {canAdvance && nextPhase && r.status !== 'COMPLETED' && (
              <button
                onClick={handleAdvance}
                disabled={advancing}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', fontSize: 13, fontWeight: 700,
                  border: 'none', borderRadius: 12, cursor: advancing ? 'not-allowed' : 'pointer',
                  background: advancing
                    ? 'rgba(16,185,129,0.4)'
                    : 'linear-gradient(135deg, #059669 0%, #10b981 50%, #06b6d4 100%)',
                  color: '#fff',
                  boxShadow: advancing ? 'none' : '0 4px 14px rgba(16,185,129,0.35)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!advancing) e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
              >
                {advancing ? <IconSpinner /> : '→'}
                {advancing ? 'Advancing…' : `Advance to ${PHASE_LABELS[nextPhase]}`}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Phase timeline ── */}
          <SectionCard icon={<IconPhase />} title="Phase Progress" accent="#6366f1">
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              {PHASES.map((phase, i) => {
                const done    = i < currentIndex
                const current = i === currentIndex
                const hist    = r.phaseHistory.find(h => h.phase === phase)
                return (
                  <div key={phase} style={{ display: 'flex', alignItems: 'flex-start', flex: i < PHASES.length - 1 ? 1 : 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700,
                        background: done    ? 'linear-gradient(135deg,#059669,#10b981)'
                                  : current ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                                  : '#f1f5f9',
                        color: done || current ? '#fff' : '#94a3b8',
                        boxShadow: current ? '0 4px 12px rgba(99,102,241,0.35)' : 'none',
                        flexShrink: 0,
                      }}>
                        {done ? '✓' : i + 1}
                      </div>
                      <span style={{
                        fontSize: 10, marginTop: 6, textAlign: 'center', width: 72,
                        color: current ? '#6366f1' : done ? '#059669' : '#94a3b8',
                        fontWeight: current ? 700 : 500,
                        lineHeight: 1.3,
                      }}>
                        {PHASE_LABELS[phase]}
                      </span>
                      {hist && (
                        <span style={{ fontSize: 9, color: '#cbd5e1', marginTop: 3, textAlign: 'center' }}>
                          {fmt(hist.startedAt)}
                        </span>
                      )}
                    </div>
                    {i < PHASES.length - 1 && (
                      <div style={{
                        flex: 1, height: 2, marginTop: 17, marginLeft: 4, marginRight: 4,
                        background: done
                          ? 'linear-gradient(90deg,#059669,#10b981)'
                          : '#e2e8f0',
                        borderRadius: 2,
                        transition: 'background 0.3s',
                      }} />
                    )}
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* ── Part 1: Request Details (read-only) ── */}
          {/*
            PREDICTED SNP / SSR rules:
              SNP  → No. of SNP = Predicted Samples,       No. of SSR = 0
              SSR  → No. of SNP = 0,                       No. of SSR = Predicted Samples
              BOTH → No. of SNP = stored snpCount (split), No. of SSR = stored ssrCount (split)
                     (manual split entered at submission — snpCount + ssrCount = predictedSamples)
          */}
          <SectionCard icon={<IconInfo />} title="Request Details" accent="#0ea5e9">
            <DataGrid items={[
              ['Year',               r.year?.toString()],
              ['Season',             r.season],
              ['Crop',               r.crop],
              ['Program',            r.program],
              ['Nursery Name',       r.sampleName],
              ['Purpose',            r.purpose],
              ['Material Stage',     r.materialStage],
              ['Project Code',       r.projectCode],
              ['Project',            r.project],
              ['Analysis',           r.analysisToBeDone],
              ['Trait / Gene',       r.traitGene],
              ['Markers per Sample', r.markersPerSample?.toString()],
              ['Marker Type',        r.markerType],
              ['No. of SNP (Predicted)',
                r.markerType ? String(predDerived.snp) : undefined],
              ['No. of SSR (Predicted)',
                r.markerType ? String(predDerived.ssr) : undefined],
              ['Predicted Samples',  r.predictedSamples?.toString()],
              ['Predicted Data Pts', r.predictedDataPoints?.toString()],
              ['Submitted By',       r.submittedBy.name],
            ]} />
          </SectionCard>

          {/* ── Part 2: Additional Details ── */}
          {/*
            ACTUAL SNP / SSR rules:
              SNP  → No. of SNP (Actual) = Actual Samples (auto), No. of SSR (Actual) = 0 (auto)
              SSR  → No. of SNP (Actual) = 0 (auto),              No. of SSR (Actual) = Actual Samples (auto)
              BOTH → No. of SNP (Actual) + No. of SSR (Actual) = Actual Samples
                     (manually entered split, e.g. 30 SNP + 70 SSR = 100 actual)
          */}
          <SectionCard
            icon={<IconEdit />}
            title="Additional Details"
            accent="#f59e0b"
            headerRight={
              canEditPart2 && !editingPart2 ? (
                <button
                  onClick={() => setEditingPart2(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', fontSize: 12, fontWeight: 600,
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(254,243,199,0.6)', color: '#92400e',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(254,243,199,0.9)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(254,243,199,0.6)')}
                >
                  <IconEdit /> Edit
                </button>
              ) : undefined
            }
          >
            {part2Success && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(209,250,229,0.8)', border: '1px solid rgba(52,211,153,0.4)',
                borderRadius: 10, padding: '10px 14px',
                color: '#065f46', fontSize: 13, fontWeight: 500, marginBottom: 20,
              }}>
                ✓ Saved successfully
              </div>
            )}

            {!editingPart2 ? (
              // ── Read-only view ──────────────────────────────────────────────
              <DataGrid items={[
                ['Priority',           r.priority === 3 ? 'High' : r.priority === 2 ? 'Medium' : 'Low'],
                ['Date Required By',   fmt(r.expectedByDate)],
                ['Date of Sampling',   fmt(r.dateOfSampling)],
                ['Date of Dispatch',   fmt(r.dateOfDispatch)],
                ['Actual Samples',     r.actualSamples?.toString()],
                ['Actual Data Points', r.actualDataPoints?.toString()],
                ['Marker Type',        r.markerType],
                // Always show SNP/SSR rows — '—' when not yet recorded
                ['No. of SNP (Actual)', readonlySnpDisplay()],
                ['No. of SSR (Actual)', readonlySsrDisplay()],
                ['Remarks',            r.notes],
              ]} />
            ) : (
              // ── Edit form ──────────────────────────────────────────────────
              <form onSubmit={handleSavePart2}>
                {part2Error && (
                  <div style={{
                    background: 'rgba(254,242,242,0.9)', border: '1px solid rgba(252,165,165,0.5)',
                    borderRadius: 10, padding: '10px 14px',
                    color: '#b91c1c', fontSize: 13, marginBottom: 20,
                  }}>
                    {part2Error}
                  </div>
                )}

                {/* ── Updated Submission Details ── */}
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                  Updated Submission Details
                </p>


                {/* ── Lab Details ── */}
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                  Lab Details
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px 20px', marginBottom: 20 }}>
                  <FormField label="Priority">
                    <select value={part2Form.priority}
                      onChange={e => setPart2Form(f => ({ ...f, priority: e.target.value }))}
                      style={inputStyle}>
                      <option value="1">Low</option>
                      <option value="2">Medium</option>
                      <option value="3">High</option>
                    </select>
                  </FormField>
                  <FormField label="Date Required By">
                    <input type="date" value={part2Form.expectedByDate}
                      onChange={e => setPart2Form(f => ({ ...f, expectedByDate: e.target.value }))}
                      style={inputStyle} />
                  </FormField>
                  <FormField label="Actual Samples">
                    <input type="number" min="0" value={part2Form.actualSamples}
                      onChange={e => setPart2Form(f => ({ ...f, actualSamples: e.target.value }))}
                      placeholder="e.g. 180" style={inputStyle} />
                  </FormField>
                  <FormField label="Actual Data Points">
                    <input type="number" min="0" value={part2Form.actualDataPoints}
                      onChange={e => setPart2Form(f => ({ ...f, actualDataPoints: e.target.value }))}
                      placeholder="e.g. 900" style={inputStyle} />
                  </FormField>
                  <FormField label="Date of Sampling">
                    <input type="date" value={part2Form.dateOfSampling}
                      onChange={e => setPart2Form(f => ({ ...f, dateOfSampling: e.target.value }))}
                      style={inputStyle} />
                  </FormField>
                  <FormField label="Date of Dispatch">
                    <input type="date" value={part2Form.dateOfDispatch}
                      onChange={e => setPart2Form(f => ({ ...f, dateOfDispatch: e.target.value }))}
                      style={inputStyle} />
                  </FormField>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', marginBottom: 20 }} />

                {/* ── Actual SNP / SSR Counts — always visible in edit mode ── */}
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                  Actual SNP / SSR Counts
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px 20px', marginBottom: 4 }}>

                  {/* Marker Type — read-only if already set in Request Details, editable otherwise */}
                  <FormField label={markerTypeIsLocked ? 'Marker Type (from Request)' : 'Marker Type *'}>
                    {markerTypeIsLocked ? (
                      <>
                        <input type="text" readOnly value={r.markerType!} style={readonlyInputStyle} />
                        <p style={{ fontSize: 10, color: '#94a3b8', margin: '4px 0 0' }}>
                          Set in Request Details — cannot be changed here
                        </p>
                      </>
                    ) : (
                      <>
                        <select
                          value={part2Form.markerType}
                          onChange={e => setPart2Form(f => ({
                            ...f,
                            markerType: e.target.value,
                            // Reset counts when marker type changes
                            snpCount: '',
                            ssrCount: '',
                          }))}
                          style={inputStyle}
                        >
                          <option value="">Select marker type…</option>
                          {MARKER_TYPE_OPTIONS.map(mt => (
                            <option key={mt} value={mt}>{mt}</option>
                          ))}
                        </select>
                        <p style={{ fontSize: 10, color: '#f59e0b', margin: '4px 0 0', fontWeight: 600 }}>
                          Not set in Request Details — select here
                        </p>
                      </>
                    )}
                  </FormField>

                  {/* No. of SNP (Actual) */}
                  <FormField label={isBoth ? 'No. of SNP (Actual) *' : 'No. of SNP (Actual)'}>
                    {isBoth ? (
                      // BOTH → manually entered
                      <input
                        type="text" inputMode="numeric" pattern="[0-9]*"
                        value={part2Form.snpCount}
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9]/g, '')
                          setPart2Form(f => ({ ...f, snpCount: val }))
                        }}
                        placeholder="e.g. 30"
                        style={{
                          ...inputStyle,
                          borderColor: !formBothValid ? '#fca5a5' : undefined,
                        }}
                      />
                    ) : (
                      // SNP or SSR → auto-calculated, read-only
                      <div style={{
                        ...readonlyInputStyle,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 12px',
                      }}>
                        <span style={{ fontWeight: 700, color: '#0f766e' }}>
                          {formMarkerType.toUpperCase() === 'SNP'
                            ? (formActualSamples !== null && !isNaN(formActualSamples) ? formActualSamples : (r.actualSamples ?? '—'))
                            : formMarkerType.toUpperCase() === 'SSR'
                            ? 0
                            : '—'}
                        </span>
                        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, background: 'rgba(241,245,249,0.8)', padding: '2px 6px', borderRadius: 4 }}>
                          auto
                        </span>
                      </div>
                    )}
                    <p style={{ fontSize: 10, color: '#94a3b8', margin: '4px 0 0' }}>
                      {!formMarkerType
                        ? 'Select Marker Type first'
                        : isBoth
                        ? 'Enter manually — SNP + SSR must equal Actual Samples'
                        : formMarkerType.toUpperCase() === 'SNP'
                        ? '= Actual Samples (Marker Type is SNP)'
                        : 'Always 0 (Marker Type is SSR)'}
                    </p>
                  </FormField>

                  {/* No. of SSR (Actual) */}
                  <FormField label={isBoth ? 'No. of SSR (Actual) *' : 'No. of SSR (Actual)'}>
                    {isBoth ? (
                      // BOTH → manually entered
                      <input
                        type="text" inputMode="numeric" pattern="[0-9]*"
                        value={part2Form.ssrCount}
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9]/g, '')
                          setPart2Form(f => ({ ...f, ssrCount: val }))
                        }}
                        placeholder="e.g. 70"
                        style={{
                          ...inputStyle,
                          borderColor: !formBothValid ? '#fca5a5' : undefined,
                        }}
                      />
                    ) : (
                      // SNP or SSR → auto-calculated, read-only
                      <div style={{
                        ...readonlyInputStyle,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 12px',
                      }}>
                        <span style={{ fontWeight: 700, color: '#0f766e' }}>
                          {formMarkerType.toUpperCase() === 'SSR'
                            ? (formActualSamples !== null && !isNaN(formActualSamples) ? formActualSamples : (r.actualSamples ?? '—'))
                            : formMarkerType.toUpperCase() === 'SNP'
                            ? 0
                            : '—'}
                        </span>
                        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, background: 'rgba(241,245,249,0.8)', padding: '2px 6px', borderRadius: 4 }}>
                          auto
                        </span>
                      </div>
                    )}
                    <p style={{ fontSize: 10, color: '#94a3b8', margin: '4px 0 0' }}>
                      {!formMarkerType
                        ? 'Select Marker Type first'
                        : isBoth
                        ? 'Enter manually — SNP + SSR must equal Actual Samples'
                        : formMarkerType.toUpperCase() === 'SSR'
                        ? '= Actual Samples (Marker Type is SSR)'
                        : 'Always 0 (Marker Type is SNP)'}
                    </p>
                  </FormField>
                </div>

                {/* Live sum feedback for BOTH */}
                {isBoth && formSnp !== null && formSsr !== null && formActualSamples !== null && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    marginBottom: 16, marginTop: 4,
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: formBothValid ? 'rgba(209,250,229,0.7)' : 'rgba(254,226,226,0.8)',
                    color:      formBothValid ? '#065f46'               : '#991b1b',
                    border: `1px solid ${formBothValid ? 'rgba(52,211,153,0.3)' : 'rgba(252,165,165,0.4)'}`,
                  }}>
                    {formBothValid
                      ? `✓ ${formSnp} + ${formSsr} = ${formActualSamples} — Totals match`
                      : `✗ ${formSnp} + ${formSsr} = ${formBothSum} — Must equal ${formActualSamples}`}
                  </div>
                )}

                {/* Warning banner when no marker type selected at all */}
                {!formMarkerType && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 16,
                    padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    background: 'rgba(254,243,199,0.7)',
                    color: '#92400e',
                    border: '1px solid rgba(251,191,36,0.4)',
                  }}>
                    ⚠ Select a Marker Type above to enable SNP / SSR entry
                  </div>
                )}

                <FormField label="Remarks">
                  <textarea rows={2} value={part2Form.notes}
                    onChange={e => setPart2Form(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any additional notes…"
                    style={{ ...inputStyle, resize: 'vertical' }} />
                </FormField>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button type="button"
                    onClick={() => { setEditingPart2(false); setPart2Error('') }}
                    style={{
                      padding: '9px 20px', fontSize: 13, fontWeight: 600,
                      border: '1px solid rgba(209,213,219,0.8)', borderRadius: 10,
                      cursor: 'pointer', background: 'rgba(255,255,255,0.8)', color: '#374151',
                    }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={savingPart2}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '9px 24px', fontSize: 13, fontWeight: 700,
                      border: 'none', borderRadius: 10,
                      cursor: savingPart2 ? 'not-allowed' : 'pointer',
                      background: savingPart2
                        ? 'rgba(245,158,11,0.4)'
                        : 'linear-gradient(135deg,#f59e0b,#fbbf24)',
                      color: '#fff',
                      boxShadow: savingPart2 ? 'none' : '0 4px 14px rgba(245,158,11,0.35)',
                    }}>
                    {savingPart2 && <IconSpinner />}
                    {savingPart2 ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </SectionCard>

          {/* ── Phase History ── */}
          {r.phaseHistory.length > 0 && (
            <SectionCard icon={<IconHistory />} title="Phase History" accent="#8b5cf6">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(248,250,252,0.8)', borderBottom: '1px solid #f1f5f9' }}>
                      {['Phase', 'Date', 'Notes'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.phaseHistory.map((h, i) => (
                      <tr key={h.id} style={{ borderBottom: i < r.phaseHistory.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1e293b' }}>
                          {PHASE_LABELS[h.phase] ?? h.phase}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b' }}>{fmt(h.startedAt)}</td>
                        <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{h.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* ── Reagent Logs ── */}
          {canSeeReagents && (
            <SectionCard icon={<IconReagent />} title={`Reagents Used (${r.reagentLogs.length})`} accent="#059669">
              {r.reagentLogs.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>No reagents logged for this request yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'rgba(248,250,252,0.8)', borderBottom: '1px solid #f1f5f9' }}>
                        {['Reagent', 'Qty Used', 'Purpose', 'Used By', 'Date'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.reagentLogs.map((log, i) => (
                        <tr key={log.id} style={{ borderBottom: i < r.reagentLogs.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1e293b' }}>{log.item.name}</td>
                          <td style={{ padding: '12px 14px', color: '#475569' }}>{log.quantityUsed} {log.item.unit}</td>
                          <td style={{ padding: '12px 14px', color: '#64748b' }}>{log.purpose}</td>
                          <td style={{ padding: '12px 14px', color: '#64748b' }}>{log.usedBy.name}</td>
                          <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{fmt(log.usedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

        </div>
      </div>
    </>
  )
}