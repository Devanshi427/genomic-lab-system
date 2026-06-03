// pages/requests/index.tsx
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'

type LabRequest = {
  id: number
  requestCode: string
  sampleName: string
  crop: string | null
  season: string | null
  year: number | null
  program: string | null
  purpose: string | null
  materialStage: string | null
  projectCode: string | null
  project: string | null
  testType: string
  analysisToBeDone: string | null
  traitGene: string | null
  markersPerSample: number | null
  markerType: string | null
  predictedSamples: number | null
  predictedDataPoints: number | null
  tentativeSamplingDate: string | null
  priority: number
  expectedByDate: string | null
  notes: string | null
  actualSamples: number | null
  actualDataPoints: number | null
  dateOfSampling: string | null
  dateOfDispatch: string | null
  dodCommittedByLab: string | null
  dnaExtractionDate: string | null
  genotypingDate: string | null
  resultsCommunicationDate: string | null
  status: string
  currentPhase: string
  submittedAt: string
  completedAt: string | null
  submittedBy: { name: string; email: string }
  assignedLab: { name: string } | null
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const PAGE_SIZE = 10
const TOTAL_COLS = 29

// ── Brand teal tokens ─────────────────────────────────────────────────────────
const TEAL_ACCENT   = '#14b8a6'
const TEAL_BORDER   = '#99f6e4'
const TEAL_SEP      = 'rgba(153,246,228,0.55)'

// ── Shared table header ───────────────────────────────────────────────────────
const TH = ({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) => (
  <th style={{
    padding: '11px 12px',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
    background: '#f8fafc',
    borderRight: `1px solid ${TEAL_SEP}`,
    ...style,
  }}>
    {children}
  </th>
)

const TD = ({
  children,
  maxW,
  style,
}: {
  children: React.ReactNode
  maxW?: number
  style?: React.CSSProperties
}) => (
  <td style={{
    padding: '12px 12px',
    fontSize: 13,
    color: '#374151',
    whiteSpace: 'nowrap',
    maxWidth: maxW ?? undefined,
    overflow: maxW ? 'hidden' : undefined,
    textOverflow: maxW ? 'ellipsis' : undefined,
    ...style,
  }}
    title={maxW && typeof children === 'string' ? children : undefined}
  >
    {children}
  </td>
)

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string }> = {
  COMPLETED:     { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  SUBMITTED:     { bg: '#eff6ff', color: '#1d4ed8', dot: '#60a5fa' },
  RECEIVED:      { bg: '#f0f9ff', color: '#0369a1', dot: '#38bdf8' },
  DNA_ISOLATION: { bg: '#fefce8', color: '#a16207', dot: '#facc15' },
  IN_PROGRESS:   { bg: '#fefce8', color: '#a16207', dot: '#facc15' },
  GENOTYPING:    { bg: '#fdf4ff', color: '#7e22ce', dot: '#c084fc' },
  ANALYSIS:      { bg: '#fff7ed', color: '#c2410c', dot: '#fb923c' },
  PENDING:       { bg: '#fef9c3', color: '#854d0e', dot: '#fbbf24' },
  CANCELLED:     { bg: '#fef2f2', color: '#b91c1c', dot: '#f87171' },
}

function StatusBadge({ status, subLabel }: { status: string; subLabel?: string }) {
  const s = STATUS_STYLES[status] ?? { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' }
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
        background: s.bg, color: s.color, letterSpacing: '0.03em',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
        {status.replace(/_/g, ' ')}
      </span>
      {subLabel && (
        <span style={{
          fontSize: 10, color: '#94a3b8', fontWeight: 500,
          paddingLeft: 10, letterSpacing: '0.03em',
        }}>
          {subLabel}
        </span>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, accent }: {
  label: string; value: number | string; sub?: string; accent: string
}) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
      background: 'rgba(255,255,255,0.82)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(229,231,235,0.8)',
      borderRadius: 16, padding: '18px 22px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)',
      display: 'flex', flexDirection: 'column', gap: 4,
      borderTop: `3px solid ${accent}`,
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{sub}</p>}
    </div>
  )
}

const LEFT_PROJECT  = 0
const LEFT_ANALYSIS = 200
const LEFT_TRAIT    = 360

export default function RequestsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [requests, setRequests]         = useState<LabRequest[]>([])
  const [loading, setLoading]           = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [statusF, setStatusF]           = useState('ALL')
  const [yearF, setYearF]               = useState('ALL')
  const [seasonF, setSeasonF]           = useState('ALL')
  const [cropF, setCropF]               = useState('ALL')
  const [projectCodeF, setProjectCodeF] = useState('')
  const [analysisF, setAnalysisF]       = useState('ALL')
  const [markerTypeF, setMarkerTypeF]   = useState('ALL')
  const [page, setPage]                 = useState(1)
  const [total, setTotal]               = useState(0)
  const [selected, setSelected]         = useState<Set<number>>(new Set())
  const [bulkLoading, setBulkLoading]   = useState(false)
  const [years, setYears]               = useState<number[]>([])
  const [kpiTotal, setKpiTotal]         = useState(0)
  const [kpiCompleted, setKpiCompleted] = useState(0)
  const [kpiPending, setKpiPending]     = useState(0)

  const role = (session?.user as Record<string, unknown>)?.role as string

  useEffect(() => {
    fetch('/api/requests?distinct=years')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setYears(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!session) return
    fetch('/api/requests?page=1&limit=9999&archived=false')
      .then(r => r.json())
      .then(data => {
        if (data?.requests) {
          const all: LabRequest[] = data.requests
          setKpiTotal(data.total ?? all.length)
          setKpiCompleted(all.filter(r => r.status === 'COMPLETED').length)
          setKpiPending(all.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED').length)
        }
      })
      .catch(() => {})
  }, [session])

  useEffect(() => {
    if (!session && status !== 'loading') router.push('/login')
  }, [session, status, router])

  function buildUrl() {
    const params = new URLSearchParams()
    if (statusF !== 'ALL')     params.set('status',      statusF)
    if (yearF !== 'ALL')       params.set('year',        yearF)
    if (seasonF !== 'ALL')     params.set('season',      seasonF)
    if (cropF !== 'ALL')       params.set('crop',        cropF)
    if (projectCodeF)          params.set('projectCode', projectCodeF)
    if (analysisF !== 'ALL')   params.set('analysis',    analysisF)
    if (markerTypeF !== 'ALL') params.set('markerType',  markerTypeF)
    params.set('archived', String(showArchived))
    params.set('page',     String(page))
    params.set('limit',    String(PAGE_SIZE))
    return `/api/requests?${params.toString()}`
  }

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function fetchRequests() {
      setLoading(true)
      try {
        const res  = await fetch(buildUrl(), { signal: controller.signal })
        const json = await res.json()
        setRequests(json.requests)
        setTotal(json.total)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchRequests()
    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, statusF, yearF, seasonF, cropF, projectCodeF, analysisF, markerTypeF, showArchived, page])

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === requests.length) setSelected(new Set())
    else setSelected(new Set(requests.map(r => r.id)))
  }

  async function doBulk(action: 'cancel' | 'archive') {
    if (selected.size === 0) return
    if (!confirm(`${action === 'cancel' ? 'Cancel' : 'Archive'} ${selected.size} request(s)?`)) return
    setBulkLoading(true)
    const res = await fetch('/api/requests/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, requestIds: Array.from(selected) }),
    })
    if (res.ok) { setSelected(new Set()); setPage(1) }
    setBulkLoading(false)
  }

  if (loading) return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: 14 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        style={{ animation: 'spin 1s linear infinite' }}>
        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity={0.3}/>
        <path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/>
      </svg>
      Loading requests…
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ padding: '24px 28px', maxWidth: '100%' }}>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard label="Total Requests" value={kpiTotal}     sub="All active requests"    accent="#10b981" />
        <KpiCard label="In Progress"    value={kpiPending}   sub="Awaiting completion"    accent="#f59e0b" />
        <KpiCard label="Completed"      value={kpiCompleted}
          sub={kpiTotal > 0 ? `${Math.round((kpiCompleted / kpiTotal) * 100)}% completion rate` : '—'}
          accent="#3b82f6" />
        <KpiCard label="Showing"        value={total}        sub="Matching current filters" accent="#8b5cf6" />
      </div>

      {/* ── Bulk toolbar ── */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
          padding: '10px 16px', background: 'rgba(239,246,255,0.9)',
          border: '1px solid rgba(191,219,254,0.8)', borderRadius: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e40af' }}>{selected.size} selected</span>
          <button onClick={() => doBulk('cancel')} disabled={bulkLoading} style={{
            fontSize: 12, padding: '5px 14px', background: '#dc2626', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
          }}>Cancel Selected</button>
          <button onClick={() => doBulk('archive')} disabled={bulkLoading} style={{
            fontSize: 12, padding: '5px 14px', background: '#d97706', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
          }}>Archive Selected</button>
          <button onClick={() => setSelected(new Set())} style={{
            fontSize: 12, color: '#6b7280', background: 'none', border: 'none',
            cursor: 'pointer', marginLeft: 'auto', textDecoration: 'underline',
          }}>Clear selection</button>
        </div>
      )}

      {/* ── Main card ── */}
      <div style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(226,232,240,0.8)', borderRadius: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 10px 40px rgba(15,23,42,0.06)',
        overflow: 'hidden',
      }}>

        {/* ── Filter bar ── */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid rgba(241,245,249,0.9)',
          display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end',
          background: 'rgba(248,250,252,0.7)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Project Code</label>
            <input type="text" placeholder="e.g. ICTP002" value={projectCodeF}
              onChange={e => { setProjectCodeF(e.target.value); setPage(1) }}
              style={{ ...inputStyle, width: 140 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Year</label>
            <select value={yearF} onChange={e => { setYearF(e.target.value); setPage(1) }} style={inputStyle}>
              <option value="ALL">All Years</option>
              {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Season</label>
            <select value={seasonF} onChange={e => { setSeasonF(e.target.value); setPage(1) }} style={inputStyle}>
              <option value="ALL">All Seasons</option>
              <option value="RABI">Rabi</option>
              <option value="SUMMER">Summer</option>
              <option value="Kharif">Kharif</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Crop</label>
            <select value={cropF} onChange={e => { setCropF(e.target.value); setPage(1) }} style={inputStyle}>
              <option value="ALL">All Crops</option>
              <option value="Rice">Rice</option>
              <option value="Cotton">Cotton</option>
              <option value="Corn">Corn</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Analysis</label>
            <select value={analysisF} onChange={e => { setAnalysisF(e.target.value); setPage(1) }} style={inputStyle}>
              <option value="ALL">All Analysis</option>
              <option value="Foreground">Foreground</option>
              <option value="Background">Background</option>
              <option value="Hybridity_Confirmation">Hybridity Confirmation</option>
              <option value="Purity_Analysis">Purity Analysis</option>
              <option value="Line Fingerprinting">Line Fingerprinting</option>
              <option value="Gene Profiling">Gene Profiling</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Marker Type</label>
            <select value={markerTypeF} onChange={e => { setMarkerTypeF(e.target.value); setPage(1) }} style={inputStyle}>
              <option value="ALL">All</option>
              <option value="SNP">SNP</option>
              <option value="SSR">SSR</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Status</label>
            <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={inputStyle}>
              <option value="ALL">All Status</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="RECEIVED">Received</option>
              <option value="DNA_ISOLATION">DNA Isolation</option>
              <option value="GENOTYPING">Genotyping</option>
              <option value="ANALYSIS">Analysis</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Archived</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
              color: '#374151', padding: '7px 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={showArchived}
                onChange={e => { setShowArchived(e.target.checked); setPage(1) }}
                style={{ accentColor: TEAL_ACCENT, width: 14, height: 14 }} />
              Show archived
            </label>
          </div>
          {(role === 'MANAGEMENT' || role === 'ADMIN') && (
            <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
              <Link href="/reports/monthly" style={{
                fontSize: 13, color: '#059669', fontWeight: 600,
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                Monthly Report
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          )}
        </div>

        {/* ── Table ── */}
        <div style={{ overflowX: 'auto' }}>
          <table className="requests-table" style={{
            fontSize: 13, borderCollapse: 'collapse',
            tableLayout: 'fixed', width: 'max-content', minWidth: '100%',
          }}>
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 300 }} />
              <col style={{ width: 300 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 120 }} />
            </colgroup>

            <thead>
              <tr style={{
                background: '#f8fafc',
                borderTop: `3px solid ${TEAL_ACCENT}`,
                borderBottom: `1px solid ${TEAL_BORDER}`,
              }}>
                <th style={{
                  padding: '11px 12px',
                  background: '#f8fafc',
                  borderRight: `1px solid ${TEAL_SEP}`,
                }}>
                  <input type="checkbox"
                    checked={selected.size === requests.length && requests.length > 0}
                    onChange={toggleAll}
                    style={{ accentColor: TEAL_ACCENT, width: 14, height: 14 }} />
                </th>

                <TH>Year</TH>
                <TH>Season</TH>
                <TH>Crop</TH>
                <TH>Program</TH>
                <TH>Nursery Name</TH>
                <TH>Purpose</TH>
                <TH>Material Stage</TH>

                <th data-sticky="true" style={{
                  padding: '11px 12px',
                  textAlign: 'left', fontWeight: 700, fontSize: 11,
                  color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                  position: 'sticky', left: LEFT_PROJECT, zIndex: 3,
                  borderRight: `1px solid ${TEAL_SEP}`,
                }}>
                  Project Code
                </th>

                <TH>Project</TH>

                <th data-sticky="true" style={{
                  padding: '11px 12px',
                  textAlign: 'left', fontWeight: 700, fontSize: 11,
                  color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                  position: 'sticky', left: LEFT_ANALYSIS, zIndex: 3,
                  borderRight: `1px solid ${TEAL_SEP}`,
                }}>
                  Analysis
                </th>

                <th data-sticky="true" style={{
                  padding: '11px 12px',
                  textAlign: 'left', fontWeight: 700, fontSize: 11,
                  color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                  position: 'sticky', left: LEFT_TRAIT, zIndex: 3,
                  borderRight: `1px solid ${TEAL_SEP}`,
                }}>
                  Trait/Gene
                </th>

                <TH>Markers/Sample</TH>
                <TH>Marker Type</TH>
                <TH>Predicted Samples</TH>
                <TH>Predicted Data Points</TH>
                <TH>Tentative Sampling</TH>
                <TH>Priority</TH>
                <TH>Expected By</TH>
                <TH>Remarks</TH>
                <TH>Actual Samples</TH>
                <TH>Actual Data Points</TH>
                <TH>Date of Sampling</TH>
                <TH>Date of Dispatch</TH>
                <TH>DOD (Lab)</TH>
                <TH>DNA Extraction</TH>
                <TH>Genotyping</TH>
                <TH>Results Comm.</TH>
                <th style={{
                  padding: '11px 12px',
                  textAlign: 'left',
                  fontWeight: 700,
                  fontSize: 11,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                  background: '#f8fafc',
                }}>
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {requests.map((r, i) => {
                const evenBg = '#ffffff'
                const oddBg  = '#f8fafc'
                const rowBg  = i % 2 === 0 ? evenBg : oddBg
                const rowClass = ['inv-row', selected.has(r.id) ? 'inv-row-selected' : ''].filter(Boolean).join(' ')

                return (
                  <>
                    <tr
                      key={r.id}
                      className={rowClass}
                      onClick={() => {
                        const next = new Set(selected)
                        if (next.has(r.id)) next.delete(r.id); else next.add(r.id)
                        setSelected(next)
                      }}
                      style={{
                        borderBottom: '1px solid rgba(241,245,249,0.9)',
                        background: rowBg,
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}>
                        <input type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                          onClick={e => e.stopPropagation()}
                          style={{ accentColor: TEAL_ACCENT, width: 14, height: 14 }} />
                      </td>
                      <TD>{r.year ?? '—'}</TD>
                      <TD>{r.season ?? '—'}</TD>
                      <TD>{r.crop ?? '—'}</TD>
                      <TD maxW={100}>{r.program ?? '—'}</TD>
                      <TD maxW={200}>{r.sampleName}</TD>
                      <TD maxW={300}>{r.purpose ?? '—'}</TD>
                      <TD maxW={120}>{r.materialStage ?? '—'}</TD>

                      <td
                        data-sticky="true"
                        style={{
                          padding: '12px 12px',
                          fontSize: 13,
                          whiteSpace: 'nowrap',
                          position: 'sticky',
                          left: LEFT_PROJECT,
                          zIndex: 2,
                          background: rowBg,
                        }}
                      >
                        <Link href={`/requests/${r.id}`} style={{
                          color: '#0f766e', fontWeight: 600, textDecoration: 'none',
                        }}>
                          {r.projectCode ?? '—'}
                        </Link>
                      </td>

                      <TD maxW={160}>{r.project ?? '—'}</TD>

                      <td
                        data-sticky="true"
                        style={{
                          padding: '12px 12px',
                          fontSize: 13,
                          color: '#374151',
                          whiteSpace: 'nowrap',
                          maxWidth: 160,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          position: 'sticky',
                          left: LEFT_ANALYSIS,
                          zIndex: 2,
                          background: rowBg,
                        }}
                        title={r.analysisToBeDone ?? undefined}
                      >
                        {r.analysisToBeDone ?? '—'}
                      </td>

                      <td
                        data-sticky="true"
                        style={{
                          padding: '12px 12px',
                          fontSize: 13,
                          color: '#374151',
                          whiteSpace: 'nowrap',
                          maxWidth: 160,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          position: 'sticky',
                          left: LEFT_TRAIT,
                          zIndex: 2,
                          background: rowBg,
                        }}
                        title={r.traitGene ?? undefined}
                      >
                        {r.traitGene ?? '—'}
                      </td>

                      <TD>{r.markersPerSample ?? '—'}</TD>
                      <TD>{r.markerType ?? '—'}</TD>
                      <TD>{r.predictedSamples ?? '—'}</TD>
                      <TD>{r.predictedDataPoints ?? '—'}</TD>
                      <TD>{fmt(r.tentativeSamplingDate)}</TD>
                      <TD>
                        {/* FIX: priority=2 was displayed as "Medium" here, but the submission
                            form labels it "Normal" and the approvals page labels it "Normal".
                            All three surfaces now use High / Normal / Low consistently. */}
                        {r.priority === 3 ? (
                          <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:'nowrap', background:'rgba(254,226,226,0.8)', color:'#b91c1c' }}>High</span>
                        ) : r.priority === 2 ? (
                          <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:'nowrap', background:'rgba(219,234,254,0.8)', color:'#1d4ed8' }}>Normal</span>
                        ) : (
                          <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:'nowrap', background:'rgba(241,245,249,0.8)', color:'#475569' }}>Low</span>
                        )}
                      </TD>
                      <TD>{fmt(r.expectedByDate)}</TD>
                      <TD maxW={140}>{r.notes ?? '—'}</TD>
                      <TD>{r.actualSamples ?? '—'}</TD>
                      <TD>{r.actualDataPoints ?? '—'}</TD>
                      <TD>{fmt(r.dateOfSampling)}</TD>
                      <TD>{fmt(r.dateOfDispatch)}</TD>
                      <TD>{fmt(r.dodCommittedByLab)}</TD>
                      <TD>{fmt(r.dnaExtractionDate)}</TD>
                      <TD>{fmt(r.genotypingDate)}</TD>
                      <TD>{fmt(r.resultsCommunicationDate)}</TD>
                      <td style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}>
                        <StatusBadge status={r.currentPhase || r.status} />
                      </td>
                    </tr>
                  </>
                )
              })}

              {requests.length === 0 && (
                <tr>
                  <td colSpan={TOTAL_COLS} style={{
                    padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14,
                  }}>
                    No requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderTop: '1px solid rgba(241,245,249,0.9)',
          background: 'rgba(248,250,252,0.5)',
        }}>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, fontWeight: 500 }}>
            Showing{' '}
            <span style={{ color: '#374151', fontWeight: 600 }}>
              {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)}
            </span>
            {' '}of{' '}
            <span style={{ color: '#374151', fontWeight: 600 }}>{total}</span>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{
              padding: '6px 18px', border: '1px solid rgba(209,213,219,0.8)',
              borderRadius: 10, fontSize: 13, cursor: 'pointer',
              background: 'rgba(255,255,255,0.8)', color: '#374151', fontWeight: 500,
              opacity: page <= 1 ? 0.4 : 1, transition: 'all 0.15s ease',
            }}>← Prev</button>
            <button disabled={page * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} style={{
              padding: '6px 18px', border: '1px solid rgba(209,213,219,0.8)',
              borderRadius: 10, fontSize: 13, cursor: 'pointer',
              background: 'rgba(255,255,255,0.8)', color: '#374151', fontWeight: 500,
              opacity: page * PAGE_SIZE >= total ? 0.4 : 1, transition: 'all 0.15s ease',
            }}>Next →</button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Style constants ────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.06em',
}

const inputStyle: React.CSSProperties = {
  padding: '7px 11px', fontSize: 13,
  borderRadius: 10, border: '1px solid rgba(209,213,219,0.8)',
  background: 'rgba(255,255,255,0.7)', color: '#374151', outline: 'none',
}