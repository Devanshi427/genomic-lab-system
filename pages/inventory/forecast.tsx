// pages/inventory/forecast.tsx
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

// ─── Types ────────────────────────────────────────────────────────────────────

type LabRequest = {
  id: number
  requestCode: string
  sampleName: string
  projectCode: string | null
  crop: string | null
  season: string | null
  year: number | null
  predictedSamples: number | null
  predictedDataPoints: number | null
}

type ClusterItem = {
  id: number
  itemId: number
  qtyPerUnit: number
  item: {
    id: number
    name: string
    lab?: { name: string } | null
  }
}

type Cluster = {
  id: number
  name: string
  description: string | null
  unit: string
  items: ClusterItem[]
}

interface ForecastRow {
  clusterId: number
  clusterName: string
  itemId: number
  itemName: string
  qtyPerUnit: number
  clusterPredictedSamples: number
  forecastedRequirement: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ padding: 64, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
      Loading…
    </div>
  )
}

const TEAL = '#14b8a6'
const TEAL_DARK = '#0d9488'
const TEAL_LIGHT = 'rgba(20,184,166,0.08)'
const TEAL_BORDER = 'rgba(20,184,166,0.22)'

// FIX: The API now supports up to 500 records per page. We fetch with
// limit=500 and show a warning banner if the total exceeds what was returned,
// so users know the forecast is incomplete rather than silently wrong.
const REQUEST_FETCH_LIMIT = 500

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ForecastPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = (session?.user as Record<string, unknown>)?.role as string

  const [requests, setRequests]             = useState<LabRequest[]>([])
  const [requestTotal, setRequestTotal]     = useState(0)
  const [clusters, setClusters]             = useState<Cluster[]>([])
  const [pageLoading, setPageLoading]       = useState(true)
  const [modalOpen, setModalOpen]           = useState(false)
  const [selectedReqIds, setSelectedReqIds] = useState<Set<number>>(new Set())
  const [clusterInputs, setClusterInputs]   = useState<Record<number, string>>({})
  const [forecastRows, setForecastRows]     = useState<ForecastRow[] | null>(null)
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (status === 'loading') return
    if (!session || (role !== 'INVENTORY_MANAGER' && role !== 'ADMIN' && role !== 'MANAGEMENT')) {
      router.push('/inventory')
    }
  }, [session, status, role, router])

  useEffect(() => {
    if (!session) return
    Promise.all([
      fetch(`/api/requests?page=1&limit=${REQUEST_FETCH_LIMIT}&archived=false`).then(r => r.json()),
      fetch('/api/inventory/clusters').then(r => r.json()),
    ])
      .then(([reqData, clusterData]) => {
        setRequests(reqData?.requests ?? [])
        setRequestTotal(reqData?.total ?? 0)
        setClusters(Array.isArray(clusterData) ? clusterData : [])
      })
      .catch(console.error)
      .finally(() => setPageLoading(false))
  }, [session])

  const totalPredictedSamples    = requests.reduce((s, r) => s + (r.predictedSamples    ?? 0), 0)
  const totalPredictedDataPoints = requests.reduce((s, r) => s + (r.predictedDataPoints ?? 0), 0)
  // FIX: Detect truncation so we can warn the user
  const isTruncated = requestTotal > requests.length

  const handleStartForecasting = () => {
    const init: Record<number, string> = {}
    clusters.forEach(c => { init[c.id] = '' })
    setClusterInputs(init)
    setSelectedReqIds(new Set())
    setExpandedClusters(new Set())
    setModalOpen(true)
  }

  const toggleRequest = (id: number) => {
    setSelectedReqIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const toggleAllRequests = () => {
    if (selectedReqIds.size === requests.length) {
      setSelectedReqIds(new Set())
    } else {
      setSelectedReqIds(new Set(requests.map(r => r.id)))
    }
  }

  const toggleClusterExpand = (id: number) => {
    setExpandedClusters(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const handleGenerateForecast = () => {
    const rows: ForecastRow[] = []
    clusters.forEach(cluster => {
      const samples = parseInt(clusterInputs[cluster.id] || '0', 10) || 0
      const items = cluster.items ?? []
      items.forEach(ci => {
        rows.push({
          clusterId:               cluster.id,
          clusterName:             cluster.name,
          itemId:                  ci.item.id,
          itemName:                ci.item.name,
          qtyPerUnit:              ci.qtyPerUnit,
          clusterPredictedSamples: samples,
          forecastedRequirement:   samples * ci.qtyPerUnit,
        })
      })
    })
    setForecastRows(rows)
    setModalOpen(false)
  }

  if (pageLoading) return <Spinner />

  const card: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 24px rgba(15,23,42,0.06)',
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    margin: 0,
  }

  const headerTh: React.CSSProperties = {
    padding: '11px 16px',
    fontSize: 11,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    whiteSpace: 'nowrap',
    background: '#f8fafc',
    borderBottom: '1.5px solid #e2e8f0',
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
          Forecast
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '5px 0 0', fontWeight: 500 }}>
          Predict required chemical quantities for the next season.
        </p>
      </div>

      {/* FIX: Show truncation warning when request list was capped */}
      {isTruncated && (
        <div style={{
          marginBottom: 20,
          padding: '12px 16px',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 12,
          fontSize: 13,
          color: '#92400e',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
          <span>
            <strong>Partial data:</strong> showing {requests.length} of {requestTotal.toLocaleString()} requests.
            The forecast below is based on this subset only. Contact your system administrator
            to increase the API page limit if your lab has a large number of active requests.
          </span>
        </div>
      )}

      {forecastRows === null && (
        <div style={{
          ...card,
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '80px 32px', gap: 16,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(20,184,166,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26,
          }}>🧪</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            No forecast generated yet
          </p>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0, textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
            Select requests and allocate predicted samples per cluster to generate the chemical requirement forecast.
          </p>
          <button
            onClick={handleStartForecasting}
            style={{
              marginTop: 8, padding: '11px 32px', fontSize: 14, fontWeight: 700,
              color: '#fff', background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`,
              border: 'none', borderRadius: 12, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(20,184,166,0.35)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(20,184,166,0.45)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(20,184,166,0.35)'
            }}
          >
            Start Forecasting
          </button>
        </div>
      )}

      {/* ── Forecast table ── */}
      {forecastRows !== null && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              onClick={handleStartForecasting}
              style={{
                padding: '9px 22px', fontSize: 13, fontWeight: 700,
                color: TEAL, background: TEAL_LIGHT,
                border: `1.5px solid ${TEAL_BORDER}`, borderRadius: 10, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(20,184,166,0.14)' }}
              onMouseLeave={e => { e.currentTarget.style.background = TEAL_LIGHT }}
            >
              ↺ Re-run Forecast
            </button>
          </div>

          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderTop: `3px solid ${TEAL}` }}>
                    {[
                      { label: 'Cluster',                align: 'left'  },
                      { label: 'Item / Chemical',        align: 'left'  },
                      { label: 'Qty Per Unit',           align: 'right' },
                      { label: 'Predicted Samples',      align: 'right' },
                      { label: 'Forecasted Requirement', align: 'right' },
                    ].map(({ label, align }) => (
                      <th key={label} style={{ ...headerTh, textAlign: align as 'left' | 'right' }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {forecastRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                        No items found in the selected clusters.
                      </td>
                    </tr>
                  ) : forecastRows.map((row, i) => (
                    <tr
                      key={`${row.clusterId}-${row.itemId}`}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: i % 2 === 1 ? '#fafafa' : '#ffffff',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(204,251,241,0.35)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 1 ? '#fafafa' : '#ffffff' }}
                    >
                      <td style={{ padding: '13px 16px', fontWeight: 700, color: '#0f172a' }}>{row.clusterName}</td>
                      <td style={{ padding: '13px 16px', color: '#334155' }}>{row.itemName}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', color: '#334155', fontWeight: 500 }}>{row.qtyPerUnit}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', color: '#334155', fontWeight: 500 }}>{row.clusterPredictedSamples.toLocaleString()}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                        <span style={{
                          fontWeight: 800,
                          color: row.forecastedRequirement > 0 ? '#0f172a' : '#94a3b8',
                          fontSize: 14,
                        }}>
                          {row.forecastedRequirement.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Modal ── */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '24px', overflowY: 'auto',
          }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div style={{
            ...card,
            width: '100%', maxWidth: 920, maxHeight: '82vh',
            display: 'flex', flexDirection: 'column',
            borderRadius: 20, overflow: 'hidden',
          }}>

            {/* ── Modal header ── */}
            <div style={{
              padding: '26px 28px 22px',
              borderBottom: '1.5px solid #e2e8f0',
              background: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  Forecasting on basis of samples
                </h2>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{
                    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#f1f5f9', border: 'none', borderRadius: 8,
                    cursor: 'pointer', fontSize: 16, color: '#64748b',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9' }}
                >
                  ×
                </button>
              </div>

              {/* KPI cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Total Predicted Samples',     value: totalPredictedSamples.toLocaleString() },
                  { label: 'Total Predicted Data Points', value: totalPredictedDataPoints.toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: 'rgba(20,184,166,0.07)',
                    border: `1.5px solid ${TEAL_BORDER}`,
                    borderRadius: 12, padding: '14px 18px',
                  }}>
                    <p style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: '0 0 4px', lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</p>
                    <p style={{ fontSize: 11, fontWeight: 700, color: TEAL, margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              {/* FIX: Show truncation warning inside modal as well */}
              {isTruncated && (
                <div style={{
                  marginTop: 12, padding: '8px 12px',
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: 8, fontSize: 12, color: '#92400e',
                }}>
                  ⚠ Showing {requests.length} of {requestTotal.toLocaleString()} requests. Forecast may be incomplete.
                </div>
              )}
            </div>

            {/* ── Modal body ── */}
            <div style={{ padding: '22px 28px', background: '#fff', flex: 1, overflowY: 'auto', minHeight: 0 }}>

              {/* Section 1: Requests */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={sectionLabel}>Requests</p>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    {selectedReqIds.size} of {requests.length} selected
                    {isTruncated && ` (${requestTotal.toLocaleString()} total)`}
                  </span>
                </div>

                <div style={{
                  border: '1.5px solid #e2e8f0', borderRadius: 12,
                  overflowX: 'auto', overflowY: 'auto', maxHeight: 220,
                }}>
                  <table style={{ minWidth: 900, borderCollapse: 'collapse', fontSize: 13 }}>
                    <colgroup>
                      <col style={{ width: 36 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 150 }} />
                      <col style={{ width: 80 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 90 }} />
                      <col style={{ width: 100 }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                        <th style={{ padding: '10px 14px', position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                          <input
                            type="checkbox"
                            checked={selectedReqIds.size === requests.length && requests.length > 0}
                            onChange={toggleAllRequests}
                            style={{ accentColor: TEAL, width: 15, height: 15, cursor: 'pointer' }}
                          />
                        </th>
                        {['Project Code', 'Nursery Name', 'Crop', 'Season / Year', 'Pred. Samples', 'Pred. Data Points'].map(h => (
                          <th key={h} style={{
                            padding: '10px 12px', textAlign: 'left',
                            fontSize: 11, fontWeight: 700, color: '#475569',
                            textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1,
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {requests.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                            No requests found.
                          </td>
                        </tr>
                      ) : requests.map((req, i) => {
                        const isChecked = selectedReqIds.has(req.id)
                        return (
                          <tr
                            key={req.id}
                            style={{
                              background: isChecked ? 'rgba(204,251,241,0.40)' : i % 2 === 1 ? '#fafafa' : '#fff',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              transition: 'background 0.1s',
                            }}
                            onClick={() => toggleRequest(req.id)}
                            onMouseEnter={e => {
                              if (!isChecked) e.currentTarget.style.background = 'rgba(204,251,241,0.22)'
                            }}
                            onMouseLeave={e => {
                              if (!isChecked) e.currentTarget.style.background = i % 2 === 1 ? '#fafafa' : '#fff'
                            }}
                          >
                            <td style={{ padding: '10px 14px', width: 36 }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleRequest(req.id)}
                                onClick={e => e.stopPropagation()}
                                style={{ accentColor: TEAL, width: 15, height: 15, cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f766e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {req.projectCode ?? '—'}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {req.sampleName}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.crop ?? '—'}</td>
                            <td style={{ padding: '10px 12px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {[req.season, req.year].filter(Boolean).join(' ') || '—'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                              {req.predictedSamples?.toLocaleString() ?? '—'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                              {req.predictedDataPoints?.toLocaleString() ?? '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {selectedReqIds.size > 0 && (() => {
                  const sel   = requests.filter(r => selectedReqIds.has(r.id))
                  const selS  = sel.reduce((s, r) => s + (r.predictedSamples    ?? 0), 0)
                  const selDp = sel.reduce((s, r) => s + (r.predictedDataPoints ?? 0), 0)
                  return (
                    <div style={{
                      display: 'flex', gap: 20, marginTop: 10,
                      padding: '10px 16px',
                      background: 'rgba(20,184,166,0.06)',
                      border: `1.5px solid ${TEAL_BORDER}`,
                      borderRadius: 10,
                    }}>
                      <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
                        {selectedReqIds.size} request{selectedReqIds.size !== 1 ? 's' : ''} selected
                      </span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>·</span>
                      <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
                        Samples: <strong style={{ color: '#0f172a', fontWeight: 800 }}>{selS.toLocaleString()}</strong>
                      </span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>·</span>
                      <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
                        Data Points: <strong style={{ color: '#0f172a', fontWeight: 800 }}>{selDp.toLocaleString()}</strong>
                      </span>
                    </div>
                  )
                })()}
              </div>

              <div style={{ borderTop: '1.5px solid #e2e8f0', margin: '0 0 22px' }} />

              {/* Section 2: Cluster allocation */}
              <div>
                <p style={{ ...sectionLabel, marginBottom: 12 }}>
                  Allocate predicted samples per cluster
                </p>

                {clusters.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: 13 }}>No clusters found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {clusters.map(cluster => {
                      const isExpanded = expandedClusters.has(cluster.id)
                      const itemCount = cluster.items?.length ?? 0
                      return (
                        <div
                          key={cluster.id}
                          style={{
                            background: '#f8fafc',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: 12, overflow: 'hidden',
                            transition: 'border-color 0.15s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{cluster.name}</span>
                              {itemCount > 0 && (
                                <button
                                  onClick={() => toggleClusterExpand(cluster.id)}
                                  style={{
                                    marginLeft: 10,
                                    fontSize: 11, fontWeight: 600,
                                    color: isExpanded ? TEAL : '#64748b',
                                    background: isExpanded ? TEAL_LIGHT : 'transparent',
                                    border: `1px solid ${isExpanded ? TEAL_BORDER : '#e2e8f0'}`,
                                    borderRadius: 6, padding: '2px 8px',
                                    cursor: 'pointer', transition: 'all 0.12s',
                                  }}
                                >
                                  {itemCount} item{itemCount !== 1 ? 's' : ''} {isExpanded ? '▲' : '▼'}
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>samples</span>
                              <input
                                type="number" min={0} placeholder="0"
                                value={clusterInputs[cluster.id] ?? ''}
                                onChange={e => setClusterInputs(prev => ({ ...prev, [cluster.id]: e.target.value }))}
                                style={{
                                  width: 100, padding: '8px 12px', fontSize: 14, fontWeight: 700,
                                  color: '#0f172a', background: '#ffffff',
                                  border: '1.5px solid #d1d5db',
                                  borderRadius: 8, outline: 'none', textAlign: 'right',
                                  transition: 'border-color 0.12s',
                                }}
                                onFocus={e => { e.currentTarget.style.borderColor = TEAL }}
                                onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db' }}
                              />
                            </div>
                          </div>

                          {isExpanded && itemCount > 0 && (
                            <div style={{
                              borderTop: '1px solid #e2e8f0',
                              padding: '10px 16px 12px',
                              background: '#fff',
                              display: 'flex', flexWrap: 'wrap', gap: 6,
                            }}>
                              {cluster.items.map(ci => (
                                <span
                                  key={ci.id}
                                  title={`${ci.item.name} × ${ci.qtyPerUnit} /${cluster.unit}`}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    fontSize: 12, fontWeight: 500, color: '#334155',
                                    background: '#f1f5f9', border: '1px solid #e2e8f0',
                                    borderRadius: 6, padding: '4px 10px',
                                    whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis',
                                  }}
                                >
                                  <span style={{ display: 'inline-block', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {ci.item.name}
                                  </span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: TEAL, background: 'rgba(20,184,166,0.10)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>
                                    ×{ci.qtyPerUnit}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Modal footer ── */}
            <div style={{
              padding: '16px 28px',
              borderTop: '1.5px solid #e2e8f0',
              display: 'flex', justifyContent: 'flex-end', gap: 10,
              background: '#f8fafc',
            }}>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  padding: '10px 24px', fontSize: 13, fontWeight: 600,
                  color: '#475569', background: '#fff',
                  border: '1.5px solid #d1d5db', borderRadius: 10, cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateForecast}
                style={{
                  padding: '10px 28px', fontSize: 13, fontWeight: 800,
                  color: '#fff', background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`,
                  border: 'none', borderRadius: 10, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(20,184,166,0.3)',
                  transition: 'transform 0.12s, box-shadow 0.12s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 18px rgba(20,184,166,0.4)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(20,184,166,0.3)'
                }}
              >
                Generate Forecast
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}