import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

// ─── Types ────────────────────────────────────────────────────────────────────

type LogEntry = {
  id: number
  quantityUsed: number
  purpose: string
  usedAt: string
  item:    { name: string; unit: string }
  usedBy:  { name: string }
  request: { requestCode: string; sampleName: string } | null
  cluster: { name: string } | null
}

type InventoryItem = { id: number; name: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconBack = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
)

const IconFilter = () => (
  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
  </svg>
)

const IconDownload = () => (
  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
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

// ─── Shared styles ────────────────────────────────────────────────────────────

const iS: React.CSSProperties = {
  border: '1px solid #e2e8f0', borderRadius: 10,
  padding: '9px 12px', fontSize: 13, color: '#1e293b',
  background: 'rgba(255,255,255,0.8)', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

const lS: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.07em', marginBottom: 6,
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LogsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [logs, setLogs]       = useState<LogEntry[]>([])
  const [items, setItems]     = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')
  const [itemId, setItemId]   = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/login'); return }
    const role = (session.user as Record<string, unknown>)?.role as string
    if (!['INVENTORY_MANAGER', 'ADMIN', 'BIOTECHNOLOGIST'].includes(role)) {
      router.push('/inventory')
    }
  }, [session, status, router])

  useEffect(() => {
    if (!session) return
    fetch('/api/inventory').then(r => r.json()).then(data => setItems(data))
  }, [session])

const loadLogs = useCallback(() => {
  setLoading(true)
  const params = new URLSearchParams()
  if (from)   params.set('from', from)
  if (to)     params.set('to', to)
  if (itemId) params.set('itemId', itemId)
  fetch(`/api/inventory/logs?${params.toString()}`)
    .then(r => r.json())
    .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false) })
    .catch(() => { setLogs([]); setLoading(false) })
}, [from, to, itemId])

  useEffect(() => { if (session) { void Promise.resolve().then(() => loadLogs()) } }, [session, loadLogs])

  function handleExport() {
    const params = new URLSearchParams()
    if (from)   params.set('from', from)
    if (to)     params.set('to', to)
    if (itemId) params.set('itemId', itemId)
    window.location.href = `/api/inventory/logs/export?${params.toString()}`
  }

  const hasFilters = !!(from || to || itemId)

  if (status === 'loading') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
      <IconSpinner />
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        input:focus, select:focus { border-color: #10b981 !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.12) !important; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 48px' }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={() => router.push('/inventory')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 500, color: '#64748b',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 0', marginBottom: 16, transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#0f172a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
          >
            <IconBack /> Back to Inventory
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', margin: 0 }}>
                Reagent Usage Logs
              </h1>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 6, marginBottom: 0 }}>
                {loading ? 'Loading…' : `${logs.length} log entr${logs.length === 1 ? 'y' : 'ies'} found`}
              </p>
            </div>

            <button
              onClick={handleExport}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', fontSize: 13, fontWeight: 700,
                border: 'none', borderRadius: 12, cursor: 'pointer',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #06b6d4 100%)',
                color: '#fff', boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(16,185,129,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(16,185,129,0.3)' }}
            >
              <IconDownload /> Download CSV
            </button>
          </div>
        </div>

        {/* ── Filter card ── */}
        <div style={{
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: 20, boxShadow: '0 8px 30px rgba(15,23,42,0.05)',
          padding: '20px 24px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <span style={{
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.08))',
              borderRadius: 9, color: '#059669',
            }}>
              <IconFilter />
            </span>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>Filter Logs</h2>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={lS}>From Date</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={iS} />
            </div>
            <div>
              <label style={lS}>To Date</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={iS} />
            </div>
            <div>
              <label style={lS}>Reagent</label>
              <select value={itemId} onChange={e => setItemId(e.target.value)} style={{ ...iS, minWidth: 180 }}>
                <option value="">All reagents</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={loadLogs}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 20px', fontSize: 13, fontWeight: 700,
                border: 'none', borderRadius: 10, cursor: 'pointer',
                background: 'linear-gradient(135deg, #059669, #10b981)',
                color: '#fff', boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
            >
              Apply Filters
            </button>
            {hasFilters && (
              <button
                onClick={() => { setFrom(''); setTo(''); setItemId('') }}
                style={{
                  fontSize: 12, fontWeight: 600, color: '#64748b',
                  background: 'none', border: 'none', cursor: 'pointer',
                  textDecoration: 'underline', paddingBottom: 2,
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Logs table ── */}
        <div style={{
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: 20, boxShadow: '0 8px 30px rgba(15,23,42,0.05)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '16px 24px',
            borderBottom: '1px solid rgba(241,245,249,0.9)',
            background: 'rgba(248,250,252,0.6)',
          }}>
            <span style={{
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.08))',
              borderRadius: 9, color: '#059669',
            }}>
              <IconReagent />
            </span>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>
              Usage Records
            </h2>
            {!loading && (
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 600,
                padding: '2px 8px', borderRadius: 20,
                background: 'rgba(209,250,229,0.8)', color: '#059669',
              }}>
                {logs.length}
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <IconSpinner />
              <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>Loading logs…</p>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>
                No log entries match your filters.
              </p>
              {hasFilters && (
                <button
                  onClick={() => { setFrom(''); setTo(''); setItemId('') }}
                  style={{ marginTop: 12, fontSize: 13, color: '#059669', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(248,250,252,0.9)', borderBottom: '1px solid rgba(241,245,249,0.9)' }}>
                    {['Reagent', 'Qty Used', 'Purpose', 'Request / Cluster', 'Used By', 'Date'].map(h => (
                      <th key={h} style={{
                        padding: '11px 16px', textAlign: 'left',
                        fontSize: 11, fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: i < logs.length - 1 ? '1px solid rgba(241,245,249,0.7)' : 'none',
                        background: i % 2 === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(248,250,252,0.3)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(240,253,244,0.6)')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(248,250,252,0.3)')}
                    >
                      {/* Reagent */}
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{log.item.name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{log.item.unit}</div>
                      </td>

                      {/* Qty */}
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          fontWeight: 700, color: '#1e293b',
                          background: 'rgba(209,250,229,0.6)',
                          padding: '3px 10px', borderRadius: 20, fontSize: 12,
                        }}>
                          {log.quantityUsed} {log.item.unit}
                        </span>
                      </td>

                      {/* Purpose */}
                      <td style={{ padding: '13px 16px', color: '#475569' }}>{log.purpose}</td>

                      {/* Request / Cluster */}
                      <td style={{ padding: '13px 16px' }}>
                        {log.request ? (
                          <>
                            <div style={{
                              fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                              color: '#6366f1', background: 'rgba(238,242,255,0.7)',
                              padding: '2px 8px', borderRadius: 6, display: 'inline-block',
                              marginBottom: 3,
                            }}>
                              {log.request.requestCode}
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{log.request.sampleName}</div>
                          </>
                        ) : log.cluster ? (
                          <>
                            <div style={{
                              fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                              color: '#f59e0b', background: 'rgba(254,243,199,0.7)',
                              padding: '2px 8px', borderRadius: 6, display: 'inline-block',
                              marginBottom: 3,
                            }}>
                              Cluster
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{log.cluster.name}</div>
                          </>
                        ) : (
                          <div style={{
                            fontSize: 11, fontWeight: 600, color: '#94a3b8',
                            fontStyle: 'italic',
                          }}>
                            —
                          </div>
                        )}
                      </td>

                      {/* Used By */}
                      <td style={{ padding: '13px 16px', color: '#475569' }}>{log.usedBy.name}</td>

                      {/* Date */}
                      <td style={{ padding: '13px 16px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {fmt(log.usedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </>
  )
}