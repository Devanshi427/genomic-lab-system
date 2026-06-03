// pages/admin/health.tsx
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

type HealthData = {
  counts: {
    userCount: number; requestCount: number; inventoryCount: number
    reagentLogCount: number; auditCount: number
  }
  alerts: { pendingTransfers: number; unassignedRequests: number }
  recentActivity: Array<{
    id: number; action: string; detail: string | null; performedAt: string
    performedBy: { name: string }
  }>
  generatedAt: string
}

const ACTION_COLOURS: Record<string, string> = {
  REQUEST_CREATED:   '#3b82f6',
  PHASE_ADVANCED:    '#8b5cf6',
  INVENTORY_CREATED: '#10b981',
  INVENTORY_UPDATED: '#f59e0b',
}

const KPI_CARDS = [
  { key: 'userCount',      label: 'Users',        accent: '#3b82f6', bg: 'rgba(59,130,246,0.07)'  },
  { key: 'requestCount',   label: 'Requests',     accent: '#8b5cf6', bg: 'rgba(139,92,246,0.07)'  },
  { key: 'inventoryCount', label: 'Inventory',    accent: '#10b981', bg: 'rgba(16,185,129,0.07)'  },
  { key: 'reagentLogCount',label: 'Reagent Logs', accent: '#f59e0b', bg: 'rgba(245,158,11,0.07)'  },
  { key: 'auditCount',     label: 'Audit Logs',   accent: '#64748b', bg: 'rgba(100,116,139,0.07)' },
] as const

export default function HealthPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)

  const role = (session?.user as Record<string, unknown>)?.role as string

  useEffect(() => {
    if (status === 'loading') return
    if (!session || role !== 'ADMIN') router.push('/login')
  }, [session, status, role, router])

  useEffect(() => {
    if (!session) return
    fetch('/api/admin/health')
      .then(r => r.json())
      .then(data => { setHealth(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [session])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '64px', color: '#94a3b8', fontSize: '13px' }}>
      Loading system health…
    </div>
  )
  if (!health) return null

  const hasAlerts = health.alerts.pendingTransfers > 0 || health.alerts.unassignedRequests > 0

  const cardStyle = {
    background: 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(226,232,240,0.8)',
    borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 10px 40px rgba(15,23,42,0.06)',
  }

  return (
    <div style={{ padding: '32px', minHeight: '100vh', background: '#f8fafc', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
          System Health
        </h1>
        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Generated {new Date(health.generatedAt).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>

      {/* Alert banners */}
      {hasAlerts && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {health.alerts.unassignedRequests > 0 && (
            <div style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: '12px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px',
              color: '#92400e',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#f59e0b', flexShrink: 0,
              }} />
              <span>
                <strong>{health.alerts.unassignedRequests}</strong> active request(s) have no lab assigned.
              </span>
            </div>
          )}
          {health.alerts.pendingTransfers > 0 && (
            <div style={{
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.20)',
              borderRadius: '12px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px',
              color: '#1e3a5f',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#3b82f6', flexShrink: 0,
              }} />
              <span>
                <strong>{health.alerts.pendingTransfers}</strong> transfer(s) awaiting approval.
              </span>
            </div>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '20px' }}>
        {KPI_CARDS.map(card => (
          <div key={card.key} style={{
            ...cardStyle,
            padding: '20px 16px',
            textAlign: 'center',
            background: card.bg,
            border: `1px solid ${card.accent}22`,
          }}>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1 }}>
              {health.counts[card.key].toLocaleString()}
            </p>
            <p style={{
              fontSize: '11px', fontWeight: 600, color: card.accent,
              marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div style={{ ...cardStyle, padding: '24px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Recent Activity
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {health.recentActivity.map((entry, i) => {
            const dot = ACTION_COLOURS[entry.action] ?? '#94a3b8'
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '11px 0',
                  borderBottom: i < health.recentActivity.length - 1 ? '1px solid rgba(226,232,240,0.5)' : 'none',
                }}
              >
                {/* Dot */}
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: dot, flexShrink: 0, marginTop: '3px',
                }} />

                {/* Timestamp */}
                <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0, marginTop: '1px', minWidth: '110px' }}>
                  {new Date(entry.performedAt).toLocaleString('en-GB', {
                    day: '2-digit', month: 'short',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>

                {/* Action tag */}
                <span style={{
                  fontSize: '11px', fontWeight: 600, color: dot,
                  background: `${dot}14`, borderRadius: '6px',
                  padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {entry.action.replace(/_/g, ' ')}
                </span>

                {/* Detail */}
                <span style={{ fontSize: '13px', color: '#374151', flex: 1 }}>
                  {entry.detail}
                </span>

                {/* Performer */}
                <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {entry.performedBy.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}