// pages/dashboard/index.tsx
import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  ArcElement, Title, Tooltip, Legend,
  type TooltipItem,
  type Plugin,
} from 'chart.js'
import { CardSkeleton, ChartSkeleton } from '../../components/Skeleton'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardStats = {
  total: number
  completedThisMonth: number
  pending: number
  inProgress: number
  onTimeRate: number
  delayed: number
  statusBreakdown: Record<string, number>
  phaseDistribution: Record<string, number>
  testTypeSplit: Record<string, number>
  // FIX: these two fields were always computed by the API but never included
  // in the response, so the frontend fell back to reading testTypeSplit
  // (a request count) for both sample numbers and data point values.
  testTypeSamples:    Record<string, number>
  testTypeDataPoints: Record<string, number>
  onTimeVsDelayed: { onTime: number; delayed: number }
  totalActualSamples: number
  totalActualDataPoints: number
  cropSamples: Record<string, number>
  cropDataPoints: Record<string, number>
  analysisSamples: Record<string, number>
}

type Filters = { year: string; month: string; crop: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  SUBMITTED: 'Submitted',
  RECEIVED: 'Received',
  DNA_ISOLATION: 'DNA Isolation',
  GENOTYPING: 'Genotyping',
  ANALYSIS: 'Analysis',
  COMPLETED: 'Completed',
}

const ANALYSIS_ORDER = [
  'Foreground',
  'Purity_Analysis',
  'Hybridity_Confirmation',
  'Background',
  'Line Fingerprinting',
  'Gene Profiling',
]

const MONTHS = [
  { value: '', label: 'All Months' },
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
]

const CROP_COLORS = ['#16a34a', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6']

const tt = {
  backgroundColor: 'rgba(15,23,42,0.9)',
  titleColor: '#f1f5f9',
  bodyColor: '#cbd5e1',
  padding: 8,
  cornerRadius: 6,
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 20,
  border: '1px solid rgba(226,232,240,0.8)',
  boxShadow: '0 8px 30px rgba(15,23,42,0.06)',
  padding: '18px 20px',
  transition: 'all 0.25s ease',
  backdropFilter: 'blur(10px)',
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#0f172a',
  margin: '0 0 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

// ─── Phase icons ─────────────────────────────────────────────────────────────

const PHASE_ICONS: Record<string, React.ReactNode> = {
  SUBMITTED:     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  RECEIVED:      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  DNA_ISOLATION: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3v6M15 3v6M9 15v6M15 15v6M9 9c0 0 1.5 1.5 3 1.5S15 9 15 9M9 15c0 0 1.5-1.5 3-1.5S15 15 15 15M9 9v6M15 9v6" /></>,
  GENOTYPING:    <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 3.5c0 0-2 3-2 6s2 6 2 6M14 3.5c0 0 2 3 2 6s-2 6-2 6M8 7h8M8 13h8" /></>,
  ANALYSIS:      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  COMPLETED:     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
}

// ─── Pipeline sub-components ──────────────────────────────────────────────────

const HConnector = () => (
  <svg width="32" height="16" viewBox="0 0 32 16" fill="none" style={{ flexShrink: 0 }}>
    <line x1="0" y1="8" x2="20" y2="8" stroke="#166534" strokeWidth="2.2" strokeDasharray="4 2.5" />
    <path d="M20 4l10 4-10 4" stroke="#166534" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
)

const VConnector = () => (
  <svg width="16" height="36" viewBox="0 0 16 36" fill="none">
    <line x1="8" y1="0" x2="8" y2="24" stroke="#166534" strokeWidth="2.2" strokeDasharray="4 2.5" />
    <path d="M4 24l4 9 4-9" stroke="#166534" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
)

const VConnectorUp = () => (
  <svg width="16" height="36" viewBox="0 0 16 36" fill="none">
    <line x1="8" y1="36" x2="8" y2="12" stroke="#166534" strokeWidth="2.2" strokeDasharray="4 2.5" />
    <path d="M4 12l4-9 4 9" stroke="#166534" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
)

interface PhaseCardProps {
  phase: string
  index: number
  phases: Record<string, number>
}

const PhaseCard = ({ phase, phases }: PhaseCardProps) => {
  const val = phases[phase] ?? 0
  const isCompleted = phase === 'COMPLETED'
  return (
    <div style={{
      width: 68,
      minWidth: 68,
      padding: '4px 4px 2px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      flexShrink: 0,
    }}>
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.6">
        {PHASE_ICONS[phase]}
      </svg>
      <span style={{
        fontSize: 13, fontWeight: 600, color: '#6b7280',
        textAlign: 'center', lineHeight: 1.25, whiteSpace: 'nowrap',
      }}>{PHASE_LABELS[phase]}</span>
      <span style={{
        fontSize: 17, fontWeight: 800,
        color: isCompleted ? '#16a34a' : '#111827', lineHeight: 1,
      }}>{val}</span>
    </div>
  )
}

function PipelineFlow({ phases }: { phases: Record<string, number> }) {
  const COL = { L: '16%', M: '50%', R: '84%' }

  const nodeStyle = (left: string): React.CSSProperties => ({
    position: 'absolute',
    left,
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  })

  const hArrowStyle = (fromPct: number, toPct: number, top: number): React.CSSProperties => ({
    position: 'absolute',
    left: `${(fromPct + toPct) / 2}%`,
    top,
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
  })

  const vArrowStyle = (left: string, top: number): React.CSSProperties => ({
    position: 'absolute',
    left,
    top,
    transform: 'translateX(-50%)',
  })

  const ROW1_TOP = 0
  const ROW2_TOP = 72
  const ROW3_TOP = 108

  return (
    <div style={{ position: 'relative', width: '100%', height: 190 }}>
      <div style={nodeStyle(COL.L)}>
        <PhaseCard phase="RECEIVED" index={2} phases={phases} />
      </div>
      <div style={nodeStyle(COL.M)}>
        <PhaseCard phase="GENOTYPING" index={4} phases={phases} />
      </div>
      <div style={nodeStyle(COL.R)}>
        <PhaseCard phase="ANALYSIS" index={5} phases={phases} />
      </div>
      <div style={hArrowStyle(50, 84, ROW1_TOP + 28)}>
        <HConnector />
      </div>
      <div style={vArrowStyle(COL.L, ROW2_TOP)}>
        <VConnector />
      </div>
      <div style={vArrowStyle(COL.M, ROW2_TOP)}>
        <VConnectorUp />
      </div>
      <div style={vArrowStyle(COL.R, ROW2_TOP)}>
        <VConnector />
      </div>
      <div style={{ ...nodeStyle(COL.L), top: ROW3_TOP }}>
        <PhaseCard phase="SUBMITTED" index={1} phases={phases} />
      </div>
      <div style={{ ...nodeStyle(COL.M), top: ROW3_TOP }}>
        <PhaseCard phase="DNA_ISOLATION" index={3} phases={phases} />
      </div>
      <div style={{ ...nodeStyle(COL.R), top: ROW3_TOP }}>
        <PhaseCard phase="COMPLETED" index={6} phases={phases} />
      </div>
      <div style={hArrowStyle(16, 50, ROW3_TOP + 28)}>
        <HConnector />
      </div>
    </div>
  )
}

// ─── SLA Ring ────────────────────────────────────────────────────────────────

function SlaRing({ pct, onTime, delayed }: { pct: number; onTime: number; delayed: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return

    const CX = 160, CY = 160, R = 120, LW = 24
    const TWO_PI  = Math.PI * 2
    const TOP     = -Math.PI / 2
    const GAP_RAD = (0.5 / 360) * TWO_PI

    const clamped    = Math.min(100, Math.max(0, pct))
    const greenSweep = TWO_PI * (clamped / 100)
    const redSweep   = TWO_PI - greenSweep

    ctx.clearRect(0, 0, 320, 320)

    ctx.beginPath()
    ctx.arc(CX, CY, R, 0, TWO_PI)
    ctx.strokeStyle = '#f3f4f6'
    ctx.lineWidth   = LW
    ctx.lineCap     = 'butt'
    ctx.stroke()

    if (greenSweep > GAP_RAD) {
      ctx.beginPath()
      ctx.arc(CX, CY, R, TOP, TOP + greenSweep - GAP_RAD)
      ctx.strokeStyle = '#16a34a'
      ctx.lineWidth   = LW
      ctx.lineCap     = 'butt'
      ctx.stroke()
    }

    if (redSweep > GAP_RAD) {
      ctx.beginPath()
      ctx.arc(CX, CY, R, TOP + greenSweep + GAP_RAD, TOP + TWO_PI)
      ctx.strokeStyle = '#f87171'
      ctx.lineWidth   = LW
      ctx.lineCap     = 'butt'
      ctx.stroke()
    }
  }, [pct])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%' }}>
      <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
        <canvas ref={ref} width={320} height={320} style={{ width: 130, height: 130, display: 'block' }} />
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: '#16a34a', lineHeight: 1, whiteSpace: 'nowrap' }}>{pct}%</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: '#6b7280', marginTop: 3, whiteSpace: 'nowrap' }}>On-Time</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {[
          { label: 'On time',         val: onTime,           color: '#16a34a', dot: '#16a34a' },
          { label: 'Delayed',         val: delayed,          color: '#ef4444', dot: '#ef4444' },
          { label: 'Total completed', val: onTime + delayed, color: '#6b7280', dot: '#9ca3af' },
        ].map(row => (
          <div key={row.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderBottom: '1px solid #f3f4f6',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, color: '#6b7280' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.dot, flexShrink: 0 }} />
              {row.label}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{row.val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Butterfly Chart ─────────────────────────────────────────────────────────

function ButterflyChart({
  snpSamples, ssrSamples, snpPoints, ssrPoints,
}: { snpSamples: number; ssrSamples: number; snpPoints: number; ssrPoints: number }) {
  const maxS = Math.max(snpSamples, ssrSamples, 1)
  const maxP = Math.max(snpPoints, ssrPoints, 1)

  const rows = [
    { label: 'SNP', samples: snpSamples, points: snpPoints },
    { label: 'SSR', samples: ssrSamples, points: ssrPoints },
  ]

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr', gap: 0, marginBottom: 10 }}>
        <div />
        <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#16a34a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Samples</div>
        <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#3b82f6', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Data Points</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr', gap: 0, marginBottom: 8 }}>
        <div />
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: 8 }}>
        {['60k', '40k', '20k', '0'].map(t => <span key={t} style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{t}</span>)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 8 }}>
          {['0', '50k', '100k', '150k', '200k', '250k'].map(t => <span key={t} style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{t}</span>)}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 'calc(44px + 50%)', top: 0, bottom: 0, width: 1.5, background: '#d1d5db', zIndex: 1 }} />
        {rows.map(row => (
          <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr', gap: 0, marginBottom: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1f2937' }}>{row.label}</span>
            <div style={{ paddingRight: 8, position: 'relative', zIndex: 2 }}>
              <div style={{ height: 18, background: '#f0fdf4', borderRadius: '6px 0 0 6px', overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ height: '100%', width: `${Math.round((row.samples / maxS) * 100)}%`, background: '#16a34a', borderRadius: '6px 0 0 6px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, minWidth: 46 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{row.samples.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div style={{ paddingLeft: 8, position: 'relative', zIndex: 2 }}>
              <div style={{ height: 18, background: '#eff6ff', borderRadius: '0 6px 6px 0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((row.points / maxP) * 100)}%`, background: '#3b82f6', borderRadius: '0 6px 6px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, minWidth: 52 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{row.points.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
        {[['#16a34a', 'Samples'], ['#3b82f6', 'Data Points']].map(([c, l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#6b7280' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Crop Donut ──────────────────────────────────────────────────────────────

function CropDonut({ title, data, total, totalLabel, colors }: {
  title: string; data: { label: string; value: number }[]; total: number; totalLabel: string; colors: string[]
}) {
  const chartData = {
    labels: data.map(d => d.label),
    datasets: [{ data: data.map(d => d.value), backgroundColor: colors, borderWidth: 2, borderColor: '#fff', hoverOffset: 4 }],
  }
  const pieOptions = {
    responsive: true, maintainAspectRatio: false, cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: { ...tt, callbacks: { title: (items: TooltipItem<'doughnut'>[]) => items[0]?.label ?? '', label: (c: TooltipItem<'doughnut'>) => ` ${c.parsed.toLocaleString()}` } },
    },
  }
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: '14px 16px', display: 'flex', flexDirection: 'column', background: '#ffffff', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#0f172a' }}>{title}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flexShrink: 0, alignSelf: 'stretch', aspectRatio: '1 / 1' }}>
          <Doughnut data={chartData} options={pieOptions} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{total.toLocaleString()}</span>
            <span style={{ fontSize: 14, color: '#9ca3af', marginTop: 3, textAlign: 'center' }}>{totalLabel}</span>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {data.map((item, i) => {
            const pct   = total > 0 ? (item.value / total) * 100 : 0
            const p     = pct.toFixed(1)
            const color = colors[i % colors.length]
            return (
              <div key={item.label} style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>{item.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingLeft: 14 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{item.value.toLocaleString()}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color }}>{p}%</span>
                </div>
                <div style={{ paddingLeft: 14, height: 4, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats]     = useState<DashboardStats | null>(null)
  const [crops, setCrops]     = useState<string[]>([])
  const [years, setYears]     = useState<number[]>([])
  const [filters, setFilters] = useState<Filters>({ year: '', month: '', crop: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    const prev = document.body.style.background
    document.body.style.background = '#f8fafc'
    return () => { document.body.style.background = prev }
  }, [])

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])

  useEffect(() => {
    if (!session) return
    fetch('/api/dashboard/crops').then(r => r.json()).then((d: { crops: string[] }) => setCrops(d.crops ?? [])).catch(() => {})
    fetch('/api/dashboard/years').then(r => r.json()).then((d: { years: number[] }) => setYears(d.years ?? [])).catch(() => {})
  }, [session])

  useEffect(() => {
    if (!session) return
    const p = new URLSearchParams()
    if (filters.year)  p.set('year',  filters.year)
    if (filters.month) p.set('month', filters.month)
    if (filters.crop)  p.set('crop',  filters.crop)
    const qs = p.toString() ? `?${p}` : ''
    let cancelled = false
    void (async () => {
      if (cancelled) return
      setLoading(true); setError('')
      try {
        const res = await fetch(`/api/dashboard/stats${qs}`)
        if (!res.ok) throw new Error(`Server error ${res.status}`)
        const data = await res.json()
        if (!cancelled) { setStats(data); setLoading(false) }
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setLoading(false) }
      }
    })()
    return () => { cancelled = true }
  }, [session, filters])

  const setFilter    = (k: keyof Filters, v: string) => setFilters(prev => ({ ...prev, [k]: v }))
  const clearFilters = () => setFilters({ year: '', month: '', crop: '' })
  const hasFilter    = !!(filters.year || filters.month || filters.crop)

  if (status === 'loading' || loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <CardSkeleton key={i} />)}</div>
        <div className="grid grid-cols-2 gap-6">{[1,2].map(i => <ChartSkeleton key={i} />)}</div>
      </div>
    )
  }

  if (error) return (
    <div style={{ padding: 16 }}>
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', color: '#991b1b', fontSize: 13 }}>{error}</div>
    </div>
  )

  if (!stats) return null

  const onTimeRate     = isNaN(stats.onTimeRate) ? 0 : stats.onTimeRate
  const cropLabels     = Object.keys(stats.cropSamples ?? {})
  const cropColors     = cropLabels.map((_, i) => CROP_COLORS[i % CROP_COLORS.length])
  const cropSampleData = cropLabels.map(c => ({ label: c, value: stats.cropSamples[c] ?? 0 }))
  const cropPointData  = cropLabels.map(c => ({ label: c, value: stats.cropDataPoints?.[c] ?? 0 }))
  const totalSamples   = stats.totalActualSamples
  const totalPoints    = stats.totalActualDataPoints
  const analysisMax    = Math.max(...ANALYSIS_ORDER.map(k => stats.analysisSamples?.[k] ?? 0), 1)

  // ── Analysis bar chart — polished ────────────────────────────────────────
  const analysisBarData = {
    labels: ANALYSIS_ORDER.map(k => k.replace(/_/g, ' ')),
    datasets: [{
      label: 'Samples',
      data: ANALYSIS_ORDER.map(k => stats.analysisSamples?.[k] ?? 0),
      backgroundColor: '#16a34a',
      borderRadius: 999,
      borderSkipped: false as const,
      categoryPercentage: 0.78,
      barPercentage: 0.72,
      barThickness: 18,
      hoverBackgroundColor: '#15803d',
      hoverBorderWidth: 0,
    }],
  }

  const analysisBarOptions = {
    indexAxis: 'y' as const,
    responsive: true, maintainAspectRatio: false,
    layout: { padding: { right: 90, left: 6, top: 4, bottom: 4 } },
    plugins: {
      legend: { display: false },
      tooltip: { ...tt, callbacks: { label: (c: TooltipItem<'bar'>) => ` ${(c.parsed.x ?? 0).toLocaleString()} samples` } },
    },
    scales: {
      x: {
        beginAtZero: true,
        max: Math.ceil(analysisMax * 1.15),
        ticks: {
          color: '#94a3b8',
          font: { size: 11, weight: 700 as const },
          callback: (v: number | string) => { const n = Number(v); return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : n === 0 ? '0' : String(v) },
        },
        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
        border: { display: false },
      },
      y: {
        ticks: {
          color: '#334155',
          font: { size: 12, weight: 700 as const },
          padding: 8,
        },
        grid: { display: false },
        border: { display: false },
      },
    },
  }

  // ── Value + % label plugin ────────────────────────────────────────────────
  const valueLabelPlugin: Plugin<'bar'> = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart
      chart.data.datasets.forEach((dataset, i) => {
        const meta = chart.getDatasetMeta(i)
        meta.data.forEach((bar, index) => {
          const value = dataset.data[index] as number
          if (!value) return
          const pos = bar.tooltipPosition(false)
          const pct = ((value / totalSamples) * 100).toFixed(1)
          ctx.save()
          ctx.fillStyle = '#1e293b'
          ctx.font = '700 12px system-ui, sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText(value.toLocaleString(), (pos.x ?? 0) + 8, (pos.y ?? 0) + 4)
          ctx.fillStyle = '#16a34a'
          ctx.font = '600 11px system-ui, sans-serif'
          ctx.fillText(`${pct}%`, (pos.x ?? 0) + 66, (pos.y ?? 0) + 4)
          ctx.restore()
        })
      })
    },
  }

  // ── Row-strip background plugin ───────────────────────────────────────────
  const rowStripPlugin: Plugin<'bar'> = {
    id: 'rowStrips',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart
      if (!chartArea) return
      const yScale = scales['y']
      const rowCount = chart.data.labels?.length ?? 0
      ctx.save()
      for (let i = 0; i < rowCount; i++) {
        const y    = yScale.getPixelForValue(i)
        const h    = 28
        const x    = chartArea.left - 6
        const w    = chartArea.right - chartArea.left + 12
        ctx.fillStyle = i % 2 === 0
          ? 'rgba(16,24,40,0.025)'
          : 'rgba(16,24,40,0.01)'
        const r = 8
        ctx.beginPath()
        ctx.moveTo(x + r, y - h / 2)
        ctx.lineTo(x + w - r, y - h / 2)
        ctx.quadraticCurveTo(x + w, y - h / 2, x + w, y - h / 2 + r)
        ctx.lineTo(x + w, y + h / 2 - r)
        ctx.quadraticCurveTo(x + w, y + h / 2, x + w - r, y + h / 2)
        ctx.lineTo(x + r, y + h / 2)
        ctx.quadraticCurveTo(x, y + h / 2, x, y + h / 2 - r)
        ctx.lineTo(x, y - h / 2 + r)
        ctx.quadraticCurveTo(x, y - h / 2, x + r, y - h / 2)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    },
  }

  // FIX F: Read testTypeSamples (actual sample counts) instead of testTypeSplit
  // (which counts the number of requests of each type, not the samples within them).
  const snpSamples = stats.testTypeSamples?.['SNP'] ?? 0
  const ssrSamples = stats.testTypeSamples?.['SSR'] ?? 0

  // FIX G+H: Read data points directly from the API's pre-computed values.
  // Previously snpPoints and ssrPoints were re-derived here as a proportion of
  // totalActualDataPoints using the (wrong) request count as a weight, which
  // gave completely incorrect numbers. The API now computes these correctly as
  // snpCount × actualSamples and ssrCount × actualSamples per request.
  const snpPoints = stats.testTypeDataPoints?.['SNP'] ?? 0
  const ssrPoints = stats.testTypeDataPoints?.['SSR'] ?? 0

  // ── KPI items ─────────────────────────────────────────────────────────────
  const kpiItems = [
    {
      label: 'Total Requests', value: stats.total, accent: '#16a34a', bg: 'rgba(22,163,74,0.07)', topBorder: 'rgba(22,163,74,0.3)',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
    },
    {
      label: 'Actual Samples', value: totalSamples.toLocaleString(), accent: '#f59e0b', bg: 'rgba(245,158,11,0.07)', topBorder: 'rgba(245,158,11,0.3)',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
    },
    {
      label: 'Data Points', value: totalPoints.toLocaleString(), accent: '#3b82f6', bg: 'rgba(59,130,246,0.07)', topBorder: 'rgba(59,130,246,0.3)',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />,
    },
    {
      label: 'Delayed Requests', value: stats.delayed, accent: '#ef4444', bg: 'rgba(239,68,68,0.07)', topBorder: 'rgba(239,68,68,0.3)',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
    },
  ]

  return (
    <div style={{ background: '#f8fafc', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10, height: 'calc(100vh - 56px)', boxSizing: 'border-box', overflow: 'hidden' }}>

      {/* ── Filter bar ── */}
      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0, boxShadow: '0 4px 18px rgba(15,23,42,0.03)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af' }}>Filter by</span>
        {[
          { val: filters.year,  fn: (v: string) => setFilter('year',  v), aria: 'year',  opts: [<option key="" value="">All Years</option>,  ...years.map(y => <option key={y} value={String(y)}>{y}</option>)] },
          { val: filters.month, fn: (v: string) => setFilter('month', v), aria: 'month', opts: MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>) },
          { val: filters.crop,  fn: (v: string) => setFilter('crop',  v), aria: 'crop',  opts: [<option key="" value="">All Crops</option>,  ...crops.map(c => <option key={c} value={c}>{c}</option>)] },
        ].map(s => (
          <select key={s.aria} aria-label={`Filter by ${s.aria}`} value={s.val} onChange={e => s.fn(e.target.value)} style={{ height: 40, padding: '0 36px 0 14px', border: '1px solid #d1d5db', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff', outline: 'none', cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', appearance: 'none' }}>{s.opts}</select>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasFilter && <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />Filters active</span>}
          {hasFilter && <button onClick={clearFilters} style={{ height: 40, padding: '0 16px', border: '1px solid #d1d5db', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>Clear all</button>}
        </div>
      </div>

      {/* ── TOP SECTION ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.55fr 1fr', gap: 12, flex: '1.8 1 0', minHeight: 0, overflow: 'hidden' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>

          {/* ── KPI strip ── */}
          <div style={{
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            flex: '0 0 76px',
            borderRadius: 20,
            border: '1px solid rgba(226,232,240,0.8)',
            boxShadow: '0 8px 30px rgba(15,23,42,0.06)',
          }}>
            {kpiItems.map((item, i) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '0 16px',
                  borderRight: i !== 3 ? '1px solid #eef2f7' : undefined,
                  height: '100%',
                  background: `linear-gradient(180deg, #ffffff 0%, #fbfcfd 100%)`,
                  borderTop: `2.5px solid ${item.topBorder}`,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: item.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={item.accent}>{item.icon}</svg>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' as const, color: '#64748b', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: '#020617', lineHeight: 1 }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Crop Analytics */}
          <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>
            <p style={sectionTitle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              Crop Analytics — Samples vs Data Points
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
              <CropDonut title="Actual Samples"     data={cropSampleData} total={totalSamples} totalLabel="Total Samples"     colors={cropColors} />
              <CropDonut title="Actual Data Points" data={cropPointData}  total={totalPoints}  totalLabel="Total Data Points" colors={cropColors} />
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>

          {/* Request Pipeline */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, overflow: 'hidden', padding: '14px 12px' }}>
            <p style={{ ...sectionTitle, margin: '0 0 8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
              Request Pipeline
            </p>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
              <div style={{ width: '100%' }}>
                <PipelineFlow phases={stats.phaseDistribution} />
              </div>
            </div>
          </div>

          {/* SLA Performance */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, padding: '14px 12px' }}>
            <p style={{ ...sectionTitle, margin: '0 0 8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" /></svg>
              SLA Performance
            </p>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', minHeight: 0 }}>
              <SlaRing pct={onTimeRate} onTime={stats.onTimeVsDelayed.onTime} delayed={stats.onTimeVsDelayed.delayed} />
            </div>
          </div>

        </div>
      </div>

      {/* ── BOTTOM ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 12, flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>

        {/* ── Analysis Type Volume ── */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', paddingBottom: 10 }}>
          <p style={sectionTitle}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Analysis Type Volume (No. of Samples)
          </p>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Bar
              data={analysisBarData}
              options={analysisBarOptions}
              plugins={[rowStripPlugin, valueLabelPlugin]}
            />
          </div>
        </div>

        {/* ── SNP vs SSR ── */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', paddingBottom: 10 }}>
          <p style={sectionTitle}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
            SNP vs SSR — Samples & Data Points
          </p>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', minHeight: 0, overflow: 'hidden' }}>
            <ButterflyChart snpSamples={snpSamples} ssrSamples={ssrSamples} snpPoints={snpPoints} ssrPoints={ssrPoints} />
          </div>
        </div>

      </div>

    </div>
  )
}