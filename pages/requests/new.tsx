// pages/requests/new.tsx
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

const THIRTY_DAY_ANALYSES = ['background', 'line fingerprinting', 'line_fingerprinting']

function getTestType(analysisToBeDone: string): '15-DAY' | '30-DAY' {
  const lower = analysisToBeDone.toLowerCase()
  return THIRTY_DAY_ANALYSES.some(a => lower.includes(a)) ? '30-DAY' : '15-DAY'
}

function getDodDays(testType: '15-DAY' | '30-DAY'): number {
  return testType === '30-DAY' ? 30 : 15
}

function calcDodDate(testType: '15-DAY' | '30-DAY'): string {
  const days = getDodDays(testType)
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  return d.toISOString().split('T')[0]
}

const ANALYSIS_OPTIONS = [
  { label: 'Foreground (15-day)',              value: 'Foreground',             days: 15 },
  { label: 'Hybridity Confirmation (15-day)', value: 'Hybridity_Confirmation', days: 15 },
  { label: 'Purity Analysis (15-day)',         value: 'Purity_Analysis',        days: 15 },
  { label: 'Gene Profiling (15-day)',          value: 'Gene Profiling',         days: 15 },
  { label: 'Background (30-day)',              value: 'Background',             days: 30 },
  { label: 'Line Fingerprinting (30-day)',     value: 'Line Fingerprinting',    days: 30 },
]

const MARKER_TYPE_OPTIONS = ['SNP', 'SSR', 'BOTH']
const CROP_OPTIONS        = ['Rice', 'Cotton', 'Corn']
const SEASON_OPTIONS = [
  { label: 'Rabi',   value: 'RABI'   },
  { label: 'Summer', value: 'SUMMER' },
  { label: 'Kharif', value: 'Kharif' },
]

const APPROVAL_PRIORITY_OPTIONS = [
  { level: 'HIGH'   as const, color: '#b91c1c', bg: 'rgba(254,226,226,0.8)', desc: 'Urgent — processed first' },
  { level: 'NORMAL' as const, color: '#1d4ed8', bg: 'rgba(219,234,254,0.8)', desc: 'Standard processing order' },
  { level: 'LOW'    as const, color: '#475569', bg: 'rgba(241,245,249,0.8)', desc: 'Lower urgency — last'      },
]

type FormState = {
  sampleName:            string
  crop:                  string
  season:                string
  year:                  string
  program:               string
  purpose:               string
  materialStage:         string
  projectCode:           string
  project:               string
  analysisToBeDone:      string
  traitGene:             string
  markersPerSample:      string
  markerType:            string
  snpCount:              string
  ssrCount:              string
  predictedSamples:      string
  tentativeSamplingDate: string
  notes:                 string
  testType:              '15-DAY' | '30-DAY'
  expectedByDate:        string
  approvalPriority:      'HIGH' | 'NORMAL' | 'LOW'
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconClipboard = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)

const IconDna = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9.75 3.75c0 4.5 4.5 4.5 4.5 9s-4.5 4.5-4.5 9M14.25 3.75c0 4.5-4.5 4.5-4.5 9s4.5 4.5 4.5 9M6 9h12M6 15h12" />
  </svg>
)

const IconArrowLeft = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
)

const IconSpinner = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
    style={{ animation: 'spin 0.8s linear infinite' }}>
    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity={0.25} />
    <path d="M21 12a9 9 0 00-9-9" strokeLinecap="round" />
  </svg>
)

// ── Shared styles ─────────────────────────────────────────────────────────────

const IC = [
  'w-full',
  'border border-gray-200',
  'rounded-xl',
  'px-3 py-2.5',
  'text-sm text-gray-800',
  'bg-white/70',
  'transition-all duration-200',
  'focus:outline-none',
  'focus:ring-4 focus:ring-emerald-200/50',
  'focus:border-emerald-400',
  'placeholder:text-gray-400',
].join(' ')

const LC = 'block text-[11px] font-700 text-slate-500 uppercase tracking-wide mb-1.5'

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.75)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.5)',
      borderRadius: 20,
      boxShadow: '0 8px 30px rgba(15,23,42,0.05)',
      padding: '28px 28px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 24, paddingBottom: 16,
        borderBottom: '1px solid rgba(241,245,249,0.9)',
      }}>
        <span style={{
          width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.08))',
          borderRadius: 10, color: '#059669',
        }}>
          {icon}
        </span>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.01em' }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className={LC} style={{ fontWeight: 700 }}>
        {label}
        {required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 5, marginBottom: 0 }}>{hint}</p>
      )}
    </div>
  )
}

function DerivedField({ value, accent }: { value: string; accent: 'blue' | 'purple' | 'emerald' }) {
  const styles = {
    blue:    { bg: 'rgba(239,246,255,0.9)', border: '#bfdbfe', color: '#1d4ed8' },
    purple:  { bg: 'rgba(250,245,255,0.9)', border: '#ddd6fe', color: '#7c3aed' },
    emerald: { bg: 'rgba(236,253,245,0.9)', border: '#a7f3d0', color: '#065f46' },
  }
  const s = styles[accent]
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700,
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      letterSpacing: '0.01em',
    }}>
      {value}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewRequestPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = (session?.user as Record<string, unknown>)?.role as string

  const [form, setForm] = useState<FormState>({
    sampleName:            '',
    crop:                  '',
    season:                '',
    year:                  '',
    program:               '',
    purpose:               '',
    materialStage:         '',
    projectCode:           '',
    project:               '',
    analysisToBeDone:      '',
    traitGene:             '',
    markersPerSample:      '',
    markerType:            '',
    snpCount:              '',
    ssrCount:              '',
    predictedSamples:      '',
    tentativeSamplingDate: '',
    notes:                 '',
    testType:              '15-DAY',
    expectedByDate:        calcDodDate('15-DAY'),
    approvalPriority:      'NORMAL',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  if (status === 'loading') return (
    <div style={{ padding: 32, color: '#94a3b8', fontSize: 14 }}>Loading...</div>
  )
  if (!session) { router.push('/login'); return null }
  if (role !== 'BREEDER' && role !== 'ADMIN') {
    return <div style={{ padding: 32, color: '#dc2626' }}>Access denied.</div>
  }

  const markersNum = parseFloat(form.markersPerSample)
  const samplesNum = parseFloat(form.predictedSamples)
  const predictedDataPoints =
    !isNaN(markersNum) && !isNaN(samplesNum) && markersNum > 0 && samplesNum > 0
      ? markersNum * samplesNum
      : null

  const isBoth         = form.markerType === 'BOTH'
  const formSnp        = form.snpCount !== '' ? parseFloat(form.snpCount) : null
  const formSsr        = form.ssrCount !== '' ? parseFloat(form.ssrCount) : null
  const formBothSum    = (formSnp ?? 0) + (formSsr ?? 0)
  const formBothValid  =
    samplesNum && formSnp !== null && formSsr !== null
      ? formBothSum === samplesNum
      : true

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    if (name === 'analysisToBeDone') {
      const derived = value ? getTestType(value) : '15-DAY'
      setForm(f => ({ ...f, analysisToBeDone: value, testType: derived, expectedByDate: calcDodDate(derived) }))
      return
    }
    if (name === 'markerType') {
      setForm(f => ({ ...f, markerType: value, snpCount: '', ssrCount: '' }))
      return
    }
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.sampleName.trim())  return setError('Nursery Name is required')
    if (!form.projectCode.trim()) return setError('Project Code is required')
    if (!form.markerType)         return setError('Marker Type is required')

    if (isBoth) {
      const snp       = parseFloat(form.snpCount)
      const ssr       = parseFloat(form.ssrCount)
      const predicted = parseFloat(form.predictedSamples)
      if (!isNaN(predicted) && !isNaN(snp) && !isNaN(ssr)) {
        if (snp + ssr !== predicted) {
          return setError(
            `No. of SNP (${snp}) + No. of SSR (${ssr}) must equal Predicted Samples (${predicted}). Currently sums to ${snp + ssr}.`
          )
        }
      }
    }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          predictedDataPoints: predictedDataPoints ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      router.push('/requests')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  const dodDays = getDodDays(form.testType)

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .field-input { font-weight: 500; }
        .field-input:focus { box-shadow: 0 0 0 4px rgba(167,243,208,0.4); border-color: #34d399; }
      `}</style>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 120px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <button
            onClick={() => router.back()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 500, color: '#64748b',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 0', marginBottom: 16, transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#0f172a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
          >
            <IconArrowLeft /> Back
          </button>

          <h1 style={{
            fontSize: 30, fontWeight: 900, color: '#0f172a',
            letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1,
          }}>
            Submit New Request
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 6, marginBottom: 0 }}>
            Fill in the details below to submit a new genotyping request.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(254,242,242,0.9)', border: '1px solid rgba(252,165,165,0.6)',
            borderRadius: 12, padding: '12px 16px',
            color: '#b91c1c', fontSize: 13, fontWeight: 500, marginBottom: 20,
          }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Section 1: Sample Information ── */}
            <SectionCard icon={<IconClipboard />} title="Sample Information">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>

                <Field label="Year">
                  <input type="number" name="year" value={form.year}
                    onChange={handleChange}
                    placeholder={String(new Date().getFullYear())}
                    className={`${IC} field-input`} />
                </Field>

                <Field label="Season">
                  <select name="season" value={form.season} onChange={handleChange}
                    className={`${IC} field-input`}>
                    <option value="">Select season…</option>
                    {SEASON_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Crop">
                  <select name="crop" value={form.crop} onChange={handleChange}
                    className={`${IC} field-input`}>
                    <option value="">Select crop…</option>
                    {CROP_OPTIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Program">
                  <input type="text" name="program" value={form.program}
                    onChange={handleChange}
                    placeholder="e.g. Hybrid Breeding"
                    className={`${IC} field-input`} />
                </Field>

                <Field label="Nursery Name" required>
                  <input type="text" name="sampleName" value={form.sampleName}
                    onChange={handleChange} required className={`${IC} field-input`} />
                </Field>

                <Field label="Purpose">
                  <input type="text" name="purpose" value={form.purpose}
                    onChange={handleChange} className={`${IC} field-input`} />
                </Field>

                <Field label="Material Stage">
                  <input type="text" name="materialStage" value={form.materialStage}
                    onChange={handleChange} className={`${IC} field-input`} />
                </Field>

                <Field label="Project Code" required>
                  <input type="text" name="projectCode" value={form.projectCode}
                    onChange={handleChange} required className={`${IC} field-input`} />
                </Field>

                <Field label="Project">
                  <input type="text" name="project" value={form.project}
                    onChange={handleChange} className={`${IC} field-input`} />
                </Field>

                <Field label="Predicted Samples">
                  <input type="number" name="predictedSamples" value={form.predictedSamples}
                    onChange={handleChange} min={0} className={`${IC} field-input`} />
                </Field>

              </div>
            </SectionCard>

            {/* ── Section 2: Analysis Details ── */}
            <SectionCard icon={<IconDna />} title="Analysis Details">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                <Field label="Analysis to be done">
                  <select name="analysisToBeDone" value={form.analysisToBeDone}
                    onChange={handleChange} className={`${IC} field-input`}>
                    <option value="">Select analysis…</option>
                    {ANALYSIS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>

                  <Field label="Trait / Gene">
                    <input type="text" name="traitGene" value={form.traitGene}
                      onChange={handleChange} className={`${IC} field-input`} />
                  </Field>

                  <Field label="Markers per Sample">
                    <input type="number" name="markersPerSample" value={form.markersPerSample}
                      onChange={handleChange} min={0} className={`${IC} field-input`} />
                  </Field>

                  <Field label="Marker Type" required>
                    <select
                      name="markerType"
                      value={form.markerType}
                      onChange={handleChange}
                      className={`${IC} field-input`}
                      style={{
                        borderColor: !form.markerType && error.toLowerCase().includes('marker type')
                          ? '#fca5a5'
                          : undefined,
                      }}
                    >
                      <option value="">Select marker type…</option>
                      {MARKER_TYPE_OPTIONS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Test Type">
                    <DerivedField
                      value={form.testType === '30-DAY' ? '30-Day Extended' : '15-Day Standard'}
                      accent={form.testType === '30-DAY' ? 'purple' : 'blue'}
                    />
                  </Field>

                  {/* SNP / SSR derived fields */}
                  {form.markerType === 'SNP' && (
                    <>
                      <Field label="No. of SNP (Predicted)">
                        <DerivedField value={form.predictedSamples || '= Predicted Samples'} accent="blue" />
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>Auto = Predicted Samples</p>
                      </Field>
                      <Field label="No. of SSR (Predicted)">
                        <DerivedField value="0" accent="emerald" />
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>Always 0 for SNP</p>
                      </Field>
                    </>
                  )}

                  {form.markerType === 'SSR' && (
                    <>
                      <Field label="No. of SNP (Predicted)">
                        <DerivedField value="0" accent="emerald" />
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>Always 0 for SSR</p>
                      </Field>
                      <Field label="No. of SSR (Predicted)">
                        <DerivedField value={form.predictedSamples || '= Predicted Samples'} accent="blue" />
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>Auto = Predicted Samples</p>
                      </Field>
                    </>
                  )}

                  {isBoth && (
                    <>
                      <Field label="No. of SNP (Predicted) *">
                        <input
                          type="text" inputMode="numeric" pattern="[0-9]*"
                          name="snpCount" value={form.snpCount}
                          onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, '')
                            setForm(f => ({ ...f, snpCount: val }))
                          }}
                          placeholder="e.g. 700"
                          className={`${IC} field-input`}
                          style={{ borderColor: !formBothValid && form.snpCount && form.ssrCount ? '#fca5a5' : undefined }}
                        />
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>SNP + SSR must equal Predicted Samples</p>
                      </Field>
                      <Field label="No. of SSR (Predicted) *">
                        <input
                          type="text" inputMode="numeric" pattern="[0-9]*"
                          name="ssrCount" value={form.ssrCount}
                          onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, '')
                            setForm(f => ({ ...f, ssrCount: val }))
                          }}
                          placeholder="e.g. 520"
                          className={`${IC} field-input`}
                          style={{ borderColor: !formBothValid && form.snpCount && form.ssrCount ? '#fca5a5' : undefined }}
                        />
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>SNP + SSR must equal Predicted Samples</p>
                      </Field>

                      {formSnp !== null && formSsr !== null && !isNaN(samplesNum) && (
                        <div style={{ gridColumn: 'span 2' }}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                            background: formBothValid ? 'rgba(209,250,229,0.7)' : 'rgba(254,226,226,0.8)',
                            color: formBothValid ? '#065f46' : '#991b1b',
                            border: `1px solid ${formBothValid ? 'rgba(52,211,153,0.3)' : 'rgba(252,165,165,0.4)'}`,
                          }}>
                            {formBothValid
                              ? `✓ ${formSnp} + ${formSsr} = ${samplesNum} — Totals match`
                              : `✗ ${formSnp} + ${formSsr} = ${formBothSum} — Must equal ${samplesNum}`}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                </div>

                <Field label="Predicted Data Points">
                  <DerivedField
                    value={predictedDataPoints != null
                      ? predictedDataPoints.toLocaleString()
                      : 'Enter markers/sample and predicted samples above'}
                    accent="emerald"
                  />
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 5, marginBottom: 0 }}>
                    Auto-calculated: Markers/Sample × Predicted Samples
                  </p>
                </Field>

                {/* ── Queue Priority ── */}
                <div>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 700,
                    color: '#64748b', textTransform: 'uppercase',
                    letterSpacing: '0.07em', marginBottom: 10,
                  }}>
                    Queue Priority
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {APPROVAL_PRIORITY_OPTIONS.map(({ level, color, bg, desc }) => {
                      const isSelected = form.approvalPriority === level
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, approvalPriority: level }))}
                          style={{
                            padding: '12px 16px',
                            border: isSelected ? `2px solid ${color}` : '2px solid rgba(226,232,240,0.8)',
                            borderRadius: 12,
                            background: isSelected ? bg : 'rgba(255,255,255,0.6)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s',
                            boxShadow: isSelected ? `0 4px 14px ${color}22` : 'none',
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 13, color: isSelected ? color : '#374151' }}>
                            {level.charAt(0) + level.slice(1).toLowerCase()} Priority
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{desc}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>

                  <Field label="Tentative Sampling Date">
                    <input type="date" name="tentativeSamplingDate"
                      value={form.tentativeSamplingDate}
                      onChange={handleChange} className={`${IC} field-input`} />
                  </Field>

                  <Field label={`DOD / Expected By (today + ${dodDays} days)`}>
                    <input type="date" name="expectedByDate" value={form.expectedByDate}
                      onChange={handleChange} className={`${IC} field-input`} />
                  </Field>

                </div>

                <Field label="Remarks">
                  <textarea name="notes" value={form.notes} onChange={handleChange}
                    rows={3} className={`${IC} field-input`}
                    style={{ resize: 'vertical' }} />
                </Field>

              </div>
            </SectionCard>

          </div>
        </form>
      </div>

      {/* ── Sticky action footer ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        background: 'rgba(255,255,255,0.85)',
        borderTop: '1px solid rgba(226,232,240,0.8)',
        boxShadow: '0 -8px 30px rgba(15,23,42,0.06)',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
      }}>
        <p style={{ fontSize: 12, color: '#94a3b8', marginRight: 'auto', marginBottom: 0 }}>
          Fields marked <span style={{ color: '#ef4444' }}>*</span> are required
        </p>

        <button
          type="button"
          onClick={() => router.push('/requests')}
          style={{
            padding: '9px 20px', fontSize: 13, fontWeight: 600,
            border: '1px solid rgba(209,213,219,0.8)',
            borderRadius: 12, cursor: 'pointer',
            background: 'rgba(255,255,255,0.8)', color: '#374151',
          }}
        >
          Cancel
        </button>

        <button
          type="submit"
          form=""
          disabled={submitting}
          onClick={handleSubmit}
          style={{
            padding: '9px 28px', fontSize: 13, fontWeight: 700,
            border: 'none', borderRadius: 12,
            cursor: submitting ? 'not-allowed' : 'pointer',
            background: submitting
              ? 'rgba(16,185,129,0.5)'
              : 'linear-gradient(135deg, #059669 0%, #10b981 50%, #06b6d4 100%)',
            color: '#fff',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: submitting ? 'none' : '0 4px 14px rgba(16,185,129,0.35)',
            opacity: submitting ? 0.75 : 1,
          }}
        >
          {submitting && <IconSpinner />}
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>
      </div>
    </>
  )
}