import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

type Transfer = {
  id: number
  quantity: number
  reason: string | null
  status: string
  createdAt: string
  fromItem: { name: string; unit: string; lab: { name: string } }
  toItem:   { name: string; unit: string; lab: { name: string } }
  requestedBy: { name: string }
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, accent,
}: { label: string; value: number | string; sub?: string; accent: string }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 140,
      background: 'rgba(255,255,255,0.82)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(229,231,235,0.8)',
      borderRadius: 16,
      padding: '18px 22px',
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
      {sub && (
        <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{sub}</p>
      )}
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string }> = {
  PENDING:   { bg: '#fef9c3', color: '#854d0e', dot: '#fbbf24' },
  APPROVED:  { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  REJECTED:  { bg: '#fef2f2', color: '#991b1b', dot: '#f87171' },
  CANCELLED: { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color, letterSpacing: '0.03em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ── Shared table cell components ──────────────────────────────────────────────
const TH = ({ children }: { children: React.ReactNode }) => (
  <th style={{
    padding: '11px 16px',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
  }}>
    {children}
  </th>
)

const TD = ({ children }: { children: React.ReactNode }) => (
  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: 13, color: '#374151' }}>
    {children}
  </td>
)

export default function TransfersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading]     = useState(true)
  const [acting, setActing]       = useState<number | null>(null)
  const [error, setError]         = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/login'); return }
    const role = (session.user as Record<string, unknown>)?.role as string
    if (role !== 'INVENTORY_MANAGER' && role !== 'ADMIN') {
      router.push('/inventory')
    }
  }, [session, status, router])

function loadTransfers() {
  fetch('/api/inventory/transfers')
    .then(r => r.json())
    .then(data => { setTransfers(Array.isArray(data) ? data : []); setLoading(false) })
    .catch(() => { setTransfers([]); setLoading(false) })
}

  useEffect(() => {
    if (!session) return
    loadTransfers()
  }, [session])

  async function handleApprove(transferId: number) {
    setActing(transferId)
    setError('')
    try {
      const res = await fetch('/api/inventory/transfer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferId })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Approval failed'); return }
      loadTransfers()
    } catch {
      setError('Network error')
    } finally {
      setActing(null)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: 14 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity={0.3}/>
          <path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/>
        </svg>
        Loading transfers…
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const pending   = transfers.filter(t => t.status === 'PENDING').length
  const approved  = transfers.filter(t => t.status === 'APPROVED').length

  return (
    <div style={{ padding: '24px 28px', maxWidth: '100%' }}>

      {/* ── KPI Strip ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard
          label="Total Transfers"
          value={transfers.length}
          sub="All transfer requests"
          accent="#10b981"
        />
        <KpiCard
          label="Pending Approval"
          value={pending}
          sub="Awaiting review"
          accent="#f59e0b"
        />
        <KpiCard
          label="Approved"
          value={approved}
          sub={transfers.length > 0 ? `${Math.round((approved / transfers.length) * 100)}% approval rate` : '—'}
          accent="#3b82f6"
        />
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid rgba(254,202,202,0.8)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: 13,
          color: '#991b1b',
        }}>
          {error}
        </div>
      )}

      {/* ── Main card ────────────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(226,232,240,0.8)',
        borderRadius: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 10px 40px rgba(15,23,42,0.06)',
        overflow: 'hidden',
      }}>

        {/* Card header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(241,245,249,0.9)',
          background: 'rgba(248,250,252,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Pending Transfers
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
              {pending} transfer{pending !== 1 ? 's' : ''} awaiting approval
            </p>
          </div>
        </div>

        {/* Table */}
        {transfers.length === 0 ? (
          <div style={{
            padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14,
          }}>
            No pending transfers. All caught up.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
                  <TH>Material</TH>
                  <TH>Qty</TH>
                  <TH>From Lab</TH>
                  <TH>To Lab</TH>
                  <TH>Reason</TH>
                  <TH>Requested By</TH>
                  <TH>Date</TH>
                  <TH>Status</TH>
                  <TH>Action</TH>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, i) => (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: '1px solid rgba(241,245,249,0.9)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(248,250,252,0.4)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(236,253,245,0.7)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        i % 2 === 0 ? 'transparent' : 'rgba(248,250,252,0.4)'
                    }}
                  >
                    <TD>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{t.fromItem.name}</span>
                    </TD>
                    <TD>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {t.quantity} <span style={{ color: '#94a3b8' }}>{t.fromItem.unit}</span>
                      </span>
                    </TD>
                    <TD>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'rgba(239,246,255,0.8)',
                        color: '#1d4ed8',
                      }}>
                        {t.fromItem.lab.name}
                      </span>
                    </TD>
                    <TD>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'rgba(240,253,244,0.8)',
                        color: '#15803d',
                      }}>
                        {t.toItem.lab.name}
                      </span>
                    </TD>
                    <TD>{t.reason ?? <span style={{ color: '#cbd5e1' }}>—</span>}</TD>
                    <TD>{t.requestedBy.name}</TD>
                    <TD>
                      <span style={{ color: '#64748b' }}>
                        {new Date(t.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </TD>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <StatusBadge status={t.status} />
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      {t.status === 'PENDING' && (
                        <button
                          onClick={() => handleApprove(t.id)}
                          disabled={acting === t.id}
                          style={{
                            padding: '5px 16px',
                            background: acting === t.id ? 'rgba(16,185,129,0.5)' : '#10b981',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: acting === t.id ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => {
                            if (acting !== t.id)
                              (e.currentTarget as HTMLButtonElement).style.background = '#059669'
                          }}
                          onMouseLeave={e => {
                            if (acting !== t.id)
                              (e.currentTarget as HTMLButtonElement).style.background = '#10b981'
                          }}
                        >
                          {acting === t.id ? 'Approving…' : 'Approve'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(241,245,249,0.9)',
          background: 'rgba(248,250,252,0.5)',
        }}>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
            {transfers.length} total transfer request{transfers.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}