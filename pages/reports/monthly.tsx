// pages/reports/monthly.tsx
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/router'
import { useEffect, useState } from 'react'

type MonthlyReportData = {
  month:             string
  year:              number
  totalSubmitted:    number
  totalCompleted:    number
  completionRate:    number
  avgTurnaroundDays: number
  onTimePct:         number
  byLab:             Array<{ labName: string; submitted: number; completed: number }>
  topReagents:       Array<{ name: string; unit: string; totalUsed: number }>
  byPhase:           Record<string, number>
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export default function MonthlyReportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const now    = new Date()

  const [year,    setYear]    = useState(now.getFullYear())
  const [month,   setMonth]   = useState(now.getMonth() + 1)
  const [data,    setData]    = useState<MonthlyReportData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/'); return }
    const role = (session?.user as Record<string, unknown>)?.role
if (status === 'authenticated' && !['BIOTECHNOLOGIST', 'INVENTORY_MANAGER', 'ADMIN', 'MANAGEMENT'].includes(role as string)) {
  router.push('/')
    }
  }, [session, status, router])

  useEffect(() => {
    const controller = new AbortController()
    let alive = true
    void (async () => {
      if (alive) setLoading(true)
      try {
        const res = await fetch(
          `/api/reports/monthly?year=${year}&month=${month}`,
          { signal: controller.signal },
        )
        if (res.ok && alive) setData((await res.json()) as MonthlyReportData)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error(err)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false; controller.abort() }
  }, [year, month])

  function downloadPDF() {
    window.open(`/api/reports/monthly-pdf?year=${year}&month=${month}`, '_blank')
  }

  const cardStyle = {
    background: 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(226,232,240,0.8)',
    borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 10px 40px rgba(15,23,42,0.06)',
  }

  const KPI_META = [
    { label: 'Submitted',       key: 'totalSubmitted',    accent: '#3b82f6', bg: 'rgba(59,130,246,0.07)',  fmt: (v: number) => String(v) },
    { label: 'Completed',       key: 'totalCompleted',    accent: '#10b981', bg: 'rgba(16,185,129,0.07)',  fmt: (v: number) => String(v) },
    { label: 'Completion Rate', key: 'completionRate',    accent: '#8b5cf6', bg: 'rgba(139,92,246,0.07)', fmt: (v: number) => `${v}%`   },
    { label: 'Avg Turnaround',  key: 'avgTurnaroundDays', accent: '#f59e0b', bg: 'rgba(245,158,11,0.07)', fmt: (v: number) => `${v}d`   },
  ] as const

  return (
    <div style={{ padding: '32px', minHeight: '100vh', background: '#f8fafc', fontFamily: 'inherit' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Monthly Operations Report
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Summary of lab activity and reagent consumption.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Month select */}
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            style={{
              border: '1px solid rgba(226,232,240,0.9)', borderRadius: '8px',
              padding: '8px 12px', fontSize: '13px', color: '#374151',
              background: '#fff', outline: 'none', cursor: 'pointer',
            }}
          >
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>

          {/* Year select */}
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{
              border: '1px solid rgba(226,232,240,0.9)', borderRadius: '8px',
              padding: '8px 12px', fontSize: '13px', color: '#374151',
              background: '#fff', outline: 'none', cursor: 'pointer',
            }}
          >
            {[0, 1, 2].map(d => {
              const y = now.getFullYear() - d
              return <option key={y} value={y}>{y}</option>
            })}
          </select>

          {/* Download PDF */}
          <button
            onClick={downloadPDF}
            style={{
              background: '#3b82f6', color: '#fff', border: 'none',
              borderRadius: '8px', padding: '8px 18px', fontSize: '13px',
              fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(59,130,246,0.25)',
            }}
          >
            ⬇ Download PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ ...cardStyle, padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          Loading report…
        </div>
      ) : !data ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {KPI_META.map(card => (
              <div key={card.label} style={{
                ...cardStyle,
                padding: '20px 18px',
                background: card.bg,
                border: `1px solid ${card.accent}22`,
              }}>
                <p style={{
                  fontSize: '11px', fontWeight: 600, color: card.accent,
                  textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0,
                }}>
                  {card.label}
                </p>
                <p style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', margin: '8px 0 0', lineHeight: 1 }}>
                  {card.fmt(data[card.key] as number)}
                </p>
              </div>
            ))}
          </div>

          {/* Top Reagents */}
          <div style={{ ...cardStyle, padding: '24px', overflow: 'hidden' }}>
            <h2 style={{
              fontSize: '13px', fontWeight: 700, color: '#0f172a',
              textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 16px',
            }}>
              Top Reagents Consumed
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
                  {['Reagent', 'Unit', 'Total Used'].map((h, i) => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: i === 2 ? 'right' : 'left',
                      fontSize: '11px', fontWeight: 600, color: '#64748b',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.topReagents.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      No reagent usage recorded this month.
                    </td>
                  </tr>
                ) : data.topReagents.map((reagent, i) => (
                  <tr
                    key={reagent.name}
                    style={{
                      borderBottom: '1px solid rgba(226,232,240,0.5)',
                      background: i % 2 === 1 ? 'rgba(248,250,252,0.4)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(236,253,245,0.7)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? 'rgba(248,250,252,0.4)' : 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: '#0f172a' }}>{reagent.name}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{reagent.unit}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{reagent.totalUsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Performance by Lab */}
          <div style={{ ...cardStyle, padding: '24px', overflow: 'hidden' }}>
            <h2 style={{
              fontSize: '13px', fontWeight: 700, color: '#0f172a',
              textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 16px',
            }}>
              Performance by Lab
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
                  {['Lab', 'Submitted', 'Completed', 'Rate'].map((h, i) => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: i === 0 ? 'left' : 'right',
                      fontSize: '11px', fontWeight: 600, color: '#64748b',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.byLab.map((lab, i) => {
                  const rate = lab.submitted > 0
                    ? Math.round((lab.completed / lab.submitted) * 100)
                    : null
                  const rateColour = rate === null ? '#94a3b8' : rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444'
                  return (
                    <tr
                      key={lab.labName}
                      style={{
                        borderBottom: '1px solid rgba(226,232,240,0.5)',
                        background: i % 2 === 1 ? 'rgba(248,250,252,0.4)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(236,253,245,0.7)')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? 'rgba(248,250,252,0.4)' : 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: '#0f172a' }}>{lab.labName}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#374151' }}>{lab.submitted}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#374151' }}>{lab.completed}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {rate === null ? (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        ) : (
                          <span style={{
                            display: 'inline-block',
                            background: `${rateColour}14`,
                            color: rateColour,
                            fontWeight: 600,
                            fontSize: '12px',
                            padding: '2px 10px',
                            borderRadius: '20px',
                          }}>
                            {rate}%
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  )
}