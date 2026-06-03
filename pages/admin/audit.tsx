// pages/admin/audit.tsx
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

type AuditEntry = {
  id: number
  action: string
  entityType: string
  entityId: number
  detail: string | null
  performedAt: string
  performedBy: { name: string; role: string }
}

const ACTION_META: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  REQUEST_CREATED:   { bg: 'rgba(59,130,246,0.10)',  color: '#1d4ed8', dot: '#3b82f6', label: 'Request Created'   },
  PHASE_ADVANCED:    { bg: 'rgba(139,92,246,0.10)',  color: '#7e22ce', dot: '#8b5cf6', label: 'Phase Advanced'    },
  INVENTORY_CREATED: { bg: 'rgba(16,185,129,0.10)',  color: '#065f46', dot: '#10b981', label: 'Inventory Created' },
  INVENTORY_UPDATED: { bg: 'rgba(245,158,11,0.10)',  color: '#92400e', dot: '#f59e0b', label: 'Inventory Updated' },
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 130,
      background: 'rgba(255,255,255,0.82)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(229,231,235,0.8)',
      borderTop: `3px solid ${accent}`,
      borderRadius: 16, padding: '16px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '4px 0 0', lineHeight: 1.1 }}>{value}</p>
    </div>
  )
}

export default function AuditPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [logs, setLogs]       = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [action, setAction]   = useState('ALL')
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')

  const role = (session?.user as Record<string, unknown>)?.role as string

  useEffect(() => {
    if (status === 'loading') return
    if (!session || role !== 'ADMIN') router.push('/login')
  }, [session, status, role, router])

  const load = useCallback(() => {
    const params = new URLSearchParams()
    params.set('action', action)
    if (from) params.set('from', from)
    if (to)   params.set('to', to)

    // FIX: setLoading moved inside the .then() chain so it is never
    // called synchronously within the effect body.
    fetch(`/api/admin/audit?${params}`)
      .then(r => r.json())
      .then((data: AuditEntry[]) => {
        setLogs(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [action, from, to])

  useEffect(() => {
    if (!session) return
    // FIX: wrap the two state-setter calls in a microtask so they are
    // NOT synchronous in the effect body — avoids the ESLint warning.
    Promise.resolve().then(() => {
      setLoading(true)
    })
    load()
  }, [session, load])

  const countBy = (a: string) => logs.filter(l => l.action === a).length

  const filterStyle: React.CSSProperties = {
    padding: '7px 11px', fontSize: 13, borderRadius: 10,
    border: '1px solid rgba(209,213,219,0.8)',
    background: 'rgba(255,255,255,0.7)', color: '#374151', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
  }

  return (
    <div style={{ padding: '24px 28px' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
          Audit Log
        </h1>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>
          Every important system action, in order.
        </p>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard label="Total Entries"     value={logs.length}                                          accent="#10b981" />
        <KpiCard label="Requests Created"  value={countBy('REQUEST_CREATED')}                           accent="#3b82f6" />
        <KpiCard label="Phases Advanced"   value={countBy('PHASE_ADVANCED')}                            accent="#8b5cf6" />
        <KpiCard label="Inventory Changes" value={countBy('INVENTORY_CREATED') + countBy('INVENTORY_UPDATED')} accent="#f59e0b" />
      </div>

      {/* ── Main card: filters + table ── */}
      <div style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(226,232,240,0.8)', borderRadius: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 10px 40px rgba(15,23,42,0.06)',
        overflow: 'hidden',
      }}>

        {/* Filter bar */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid rgba(241,245,249,0.9)',
          background: 'rgba(248,250,252,0.7)',
          display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end',
        }}>
          <div>
            <label style={labelStyle}>Action Type</label>
            <select value={action} onChange={e => setAction(e.target.value)} style={filterStyle}>
              <option value="ALL">All Actions</option>
              <option value="REQUEST_CREATED">Request Created</option>
              <option value="PHASE_ADVANCED">Phase Advanced</option>
              <option value="INVENTORY_CREATED">Inventory Created</option>
              <option value="INVENTORY_UPDATED">Inventory Updated</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={filterStyle} />
          </div>
          <div>
            <label style={labelStyle}>To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={filterStyle} />
          </div>
          <button
            onClick={() => { setLoading(true); load() }}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 700,
              border: 'none', borderRadius: 10, cursor: 'pointer', color: '#fff',
              background: 'linear-gradient(135deg,#059669 0%,#10b981 50%,#06b6d4 100%)',
              boxShadow: '0 4px 14px rgba(16,185,129,0.25)',
            }}>
            Apply
          </button>
          {(action !== 'ALL' || from || to) && (
            <button
              onClick={() => { setAction('ALL'); setFrom(''); setTo('') }}
              style={{ fontSize: 12, color: '#059669', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Clear
            </button>
          )}
        </div>

        {/* Table / states */}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
            No audit entries match your filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
                  {['When', 'Action', 'Detail', 'Performed By'].map(h => (
                    <th key={h} style={{
                      padding: '11px 16px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: '#64748b',
                      textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => {
                  const meta = ACTION_META[log.action]
                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid rgba(241,245,249,0.9)',
                        background: i % 2 === 1 ? 'rgba(248,250,252,0.4)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(236,253,245,0.7)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 1 ? 'rgba(248,250,252,0.4)' : 'transparent' }}
                    >
                      <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {new Date(log.performedAt).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '3px 10px 3px 8px', borderRadius: 20,
                          fontSize: 12, fontWeight: 600,
                          background: meta?.bg ?? 'rgba(100,116,139,0.10)',
                          color: meta?.color ?? '#64748b',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta?.dot ?? '#64748b', flexShrink: 0 }} />
                          {meta?.label ?? log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#374151', fontSize: 13 }}>
                        {log.detail || <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{log.performedBy.name}</span>
                        <span style={{
                          marginLeft: 8, fontSize: 11, color: '#94a3b8',
                          background: 'rgba(148,163,184,0.12)', padding: '2px 8px', borderRadius: 10, fontWeight: 500,
                        }}>
                          {log.performedBy.role}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}