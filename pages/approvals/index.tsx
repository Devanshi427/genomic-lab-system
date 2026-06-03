// pages/approvals/index.tsx
import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalRequest = {
  id:               number
  requestCode:      string
  projectCode:      string | null
  sampleName:       string
  crop:             string | null
  testType:         string
  analysisToBeDone: string | null
  // FIX: actualSamples is nullable — null means "Not Entered" (only filled
  // after the breeder explicitly saves it on the Internal Request page).
  // predictedSamples is kept for reference display only.
  actualSamples:    number | null
  predictedSamples: number | null
  submittedAt:      string
  submittedBy:      { name: string; email: string }
  assignedLab:      { name: string } | null
  approvalQueue: {
    approvalStatus:   string
    approvalPriority: string
    approvalDate:     string | null
    queuePosition:    number | null
    approvedSamples:  number
    rejectedSamples:  number
    rejectionReason:  string | null
    approvedBy:       { name: string } | null
  } | null
}

type CapacityData = {
  weekStart:    string
  weekEnd:      string
  dnaIsolation: { weeklyCapacity: number; approvedThisWeek: number; remainingCapacity: number }
  genotyping:   { weeklyCapacity: number; approvedThisWeek: number; remainingCapacity: number }
  queue:        { pendingRequests: number; pendingSamples: number }
}

type ModalType = 'partial_approve' | 'partial_reject' | 'reject' | 'edit_capacity'

type ModalState =
  | { type: 'partial_approve'; request: ApprovalRequest }
  | { type: 'partial_reject';  request: ApprovalRequest }
  | { type: 'reject';          request: ApprovalRequest }
  | { type: 'edit_capacity' }
  | null

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAL       = '#14b8a6'
const TEAL_DARK  = '#0d9488'
const TEAL_LIGHT = 'rgba(20,184,166,0.08)'
const TEAL_BDR   = 'rgba(20,184,166,0.22)'

const STATUS_META: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  PENDING_APPROVAL:   { bg: 'rgba(254,243,199,0.9)', color: '#92400e', dot: '#f59e0b', label: 'Pending Approval'   },
  PARTIALLY_APPROVED: { bg: 'rgba(209,250,229,0.8)', color: '#065f46', dot: '#10b981', label: 'Partially Approved' },
  APPROVED:           { bg: 'rgba(209,250,229,0.9)', color: '#064e3b', dot: '#059669', label: 'Approved'           },
  PARTIALLY_REJECTED: { bg: 'rgba(255,237,213,0.9)', color: '#c2410c', dot: '#f97316', label: 'Partially Rejected' },
  REJECTED:           { bg: 'rgba(254,226,226,0.9)', color: '#991b1b', dot: '#f87171', label: 'Rejected'           },
}

const PRIORITY_META: Record<string, { bg: string; color: string; label: string }> = {
  HIGH:   { bg: 'rgba(254,226,226,0.8)', color: '#b91c1c', label: 'High'   },
  NORMAL: { bg: 'rgba(219,234,254,0.8)', color: '#1d4ed8', label: 'Normal' },
  LOW:    { bg: 'rgba(241,245,249,0.8)', color: '#475569', label: 'Low'    },
}

const PAGE_SIZE = 20

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function pct(part: number, total: number) {
  if (!total) return 0
  return Math.min(100, Math.round((part / total) * 100))
}

function queue(r: ApprovalRequest) {
  return {
    approvalStatus:   r.approvalQueue?.approvalStatus   ?? 'PENDING_APPROVAL',
    approvalPriority: r.approvalQueue?.approvalPriority ?? 'NORMAL',
    approvalDate:     r.approvalQueue?.approvalDate     ?? null,
    queuePosition:    r.approvalQueue?.queuePosition    ?? null,
    approvedSamples:  r.approvalQueue?.approvedSamples  ?? 0,
    rejectedSamples:  r.approvalQueue?.rejectedSamples  ?? 0,
    rejectionReason:  r.approvalQueue?.rejectionReason  ?? null,
    approvedBy:       r.approvalQueue?.approvedBy       ?? null,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QueueTH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{
      padding: '11px 14px',
      textAlign: right ? 'right' : 'left',
      fontSize: 11, fontWeight: 700, color: '#64748b',
      textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
      background: '#f8fafc',
      borderBottom: `1.5px solid ${TEAL_BDR}`,
    }}>
      {children}
    </th>
  )
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8', label: status }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: m.bg, color: m.color, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const m = PRIORITY_META[priority] ?? { bg: '#f1f5f9', color: '#475569', label: priority }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: m.bg, color: m.color, whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  )
}

function SampleBar({ approved, rejected, total }: { approved: number; rejected: number; total: number }) {
  const approvedPct = pct(approved, total)
  const rejectedPct = pct(rejected, total)
  const remaining   = total - approved - rejected
  return (
    <div style={{ minWidth: 100 }}>
      <div style={{
        height: 6, background: '#f1f5f9', borderRadius: 9,
        overflow: 'hidden', display: 'flex',
      }}>
        {approvedPct > 0 && (
          <div style={{ height: '100%', width: `${approvedPct}%`, background: '#10b981', transition: 'width 0.3s' }} />
        )}
        {rejectedPct > 0 && (
          <div style={{ height: '100%', width: `${rejectedPct}%`, background: '#f87171', transition: 'width 0.3s' }} />
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 3, fontSize: 10, fontWeight: 600, flexWrap: 'wrap' }}>
        {approved > 0 && <span style={{ color: '#059669' }}>✓{approved.toLocaleString()}</span>}
        {rejected > 0 && <span style={{ color: '#dc2626' }}>✗{rejected.toLocaleString()}</span>}
        {remaining > 0 && <span style={{ color: '#94a3b8' }}>~{remaining.toLocaleString()}</span>}
      </div>
    </div>
  )
}

function PrioritySelect({ requestId, current, onChange }: {
  requestId: number; current: string; onChange: () => void
}) {
  const [saving, setSaving] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true)
    try {
      await fetch(`/api/approvals/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_priority', priority: e.target.value }),
      })
      onChange()
    } finally {
      setSaving(false)
    }
  }

  const m = PRIORITY_META[current] ?? { bg: '#f1f5f9', color: '#374151' }
  return (
    <select value={current} onChange={handleChange} disabled={saving}
      style={{
        border: '1px solid rgba(209,213,219,0.8)', borderRadius: 7,
        padding: '4px 8px', fontSize: 12, fontWeight: 600,
        color: m.color, background: m.bg, outline: 'none', cursor: 'pointer',
      }}>
      <option value="HIGH">High</option>
      <option value="NORMAL">Normal</option>
      <option value="LOW">Low</option>
    </select>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function ApprovalModal({ modal, onClose, onSubmit, loading }: {
  modal:    ModalState
  onClose:  () => void
  onSubmit: (data: {
    action: string; samples?: number; reason?: string
    dnaCapacity?: number; genoCapacity?: number
  }) => Promise<void>
  loading: boolean
}) {
  const [samples,      setSamples]      = useState('')
  const [reason,       setReason]       = useState('')
  const [dnaCapacity,  setDnaCapacity]  = useState('')
  const [genoCapacity, setGenoCapacity] = useState('')

  useEffect(() => {
    if (!modal) return
    setSamples(''); setReason(''); setDnaCapacity(''); setGenoCapacity('')
  }, [modal?.type]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!modal) return null

  const iS: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid #e2e8f0', borderRadius: 10,
    padding: '9px 12px', fontSize: 13, color: '#1e293b',
    background: 'rgba(255,255,255,0.9)', outline: 'none',
  }
  const lS: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
  }

  let title = ''; let desc = ''; let submitLabel = ''; let submitColor = TEAL
  let maxSamples = 999999

  if (modal.type === 'partial_approve') {
    const req  = (modal as { type: ModalType; request: ApprovalRequest }).request
    const q    = queue(req)
    // FIX: use actualSamples only — never fall back to predictedSamples for approval math
    const total = req.actualSamples ?? 0
    maxSamples  = total - q.approvedSamples - q.rejectedSamples
    title       = 'Partial Approval'
    desc        = `Enter how many of the ${maxSamples.toLocaleString()} remaining samples to approve.`
    submitLabel = 'Approve Samples'
    submitColor = '#059669'
  } else if (modal.type === 'partial_reject') {
    const req  = (modal as { type: ModalType; request: ApprovalRequest }).request
    const q    = queue(req)
    const total = req.actualSamples ?? 0
    maxSamples  = total - q.approvedSamples - q.rejectedSamples
    title       = 'Partial Rejection'
    desc        = `Enter how many of the ${maxSamples.toLocaleString()} remaining samples to reject.`
    submitLabel = 'Reject Samples'
    submitColor = '#dc2626'
  } else if (modal.type === 'reject') {
    title       = 'Reject Request'
    desc        = 'Optionally provide a reason for this rejection.'
    submitLabel = 'Reject Request'
    submitColor = '#dc2626'
  } else if (modal.type === 'edit_capacity') {
    title       = 'Edit Weekly Capacity'
    desc        = 'Set the number of samples each service can process this week.'
    submitLabel = 'Save Capacities'
    submitColor = TEAL
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (modal!.type === 'partial_approve') {
      await onSubmit({ action: 'partial_approve', samples: parseInt(samples) })
    } else if (modal!.type === 'partial_reject') {
      await onSubmit({ action: 'partial_reject', samples: parseInt(samples), reason })
    } else if (modal!.type === 'reject') {
      await onSubmit({ action: 'reject', reason })
    } else if (modal!.type === 'edit_capacity') {
      await onSubmit({ action: 'edit_capacity', dnaCapacity: parseInt(dnaCapacity), genoCapacity: parseInt(genoCapacity) })
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)',
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'rgba(255,255,255,0.97)', borderRadius: 20,
        boxShadow: '0 25px 80px rgba(15,23,42,0.25)',
        width: '100%', maxWidth: 480,
        border: '1px solid rgba(226,232,240,0.8)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid rgba(241,245,249,0.9)',
          background: 'rgba(248,250,252,0.8)',
        }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{title}</p>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>{desc}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(modal.type === 'partial_approve' || modal.type === 'partial_reject') && (
              <div>
                <label style={lS}>
                  Number of Samples {modal.type === 'partial_approve' ? 'to Approve' : 'to Reject'} *
                </label>
                <input
                  required type="number" min="1" max={maxSamples}
                  value={samples} onChange={e => setSamples(e.target.value)}
                  placeholder={`Max ${maxSamples}`} style={iS} autoFocus
                />
              </div>
            )}
            {(modal.type === 'reject' || modal.type === 'partial_reject') && (
              <div>
                <label style={lS}>Reason (optional)</label>
                <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Enter reason for rejection…"
                  style={{ ...iS, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            )}
            {modal.type === 'edit_capacity' && (
              <>
                <div>
                  <label style={lS}>DNA Isolation — Weekly Capacity (samples) *</label>
                  <input required type="number" min="1" value={dnaCapacity}
                    onChange={e => setDnaCapacity(e.target.value)}
                    placeholder="e.g. 2000" style={iS} autoFocus />
                </div>
                <div>
                  <label style={lS}>Genotyping — Weekly Capacity (samples) *</label>
                  <input required type="number" min="1" value={genoCapacity}
                    onChange={e => setGenoCapacity(e.target.value)}
                    placeholder="e.g. 4000" style={iS} />
                </div>
              </>
            )}
          </div>

          <div style={{
            padding: '12px 20px', borderTop: '1px solid rgba(241,245,249,0.9)',
            background: 'rgba(248,250,252,0.6)',
            display: 'flex', gap: 10, justifyContent: 'flex-end',
          }}>
            <button type="button" onClick={onClose} disabled={loading}
              style={{
                padding: '8px 18px', fontSize: 13, fontWeight: 600,
                border: '1px solid rgba(209,213,219,0.8)', borderRadius: 10,
                background: 'rgba(255,255,255,0.8)', color: '#374151', cursor: 'pointer',
              }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{
                padding: '8px 20px', fontSize: 13, fontWeight: 700,
                border: 'none', borderRadius: 10,
                background: loading ? `${submitColor}88` : submitColor,
                color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : `0 4px 14px ${submitColor}44`,
              }}>
              {loading ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const role = (session?.user as Record<string, unknown>)?.role as string

  const [requests,   setRequests]   = useState<ApprovalRequest[]>([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [capacity,   setCapacity]   = useState<CapacityData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [actLoading, setActLoading] = useState(false)
  const [error,      setError]      = useState('')
  const [modal,      setModal]      = useState<ModalState>(null)
  const [selected,   setSelected]   = useState<Set<number>>(new Set())

  const [filterStatus,   setFilterStatus]   = useState('ALL')
  const [filterPriority, setFilterPriority] = useState('ALL')
  const [search,         setSearch]         = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const isAdmin      = role === 'ADMIN'
  const isManagement = role === 'MANAGEMENT'
  const isBreeder    = role === 'BREEDER'

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/login'); return }
    const allowed = ['ADMIN', 'MANAGEMENT', 'BREEDER', 'BIOTECHNOLOGIST']
    if (!allowed.includes(role)) router.push('/')
  }, [session, status, role, router])

  const loadCapacity = useCallback(async () => {
    try {
      const r = await fetch('/api/approvals/capacity')
      if (r.ok) setCapacity(await r.json())
    } catch { /* silent */ }
  }, [])

  const loadRequests = useCallback(async () => {
    if (!session) return
    setLoading(true); setError('')
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (filterStatus   !== 'ALL') p.set('status',   filterStatus)
      if (filterPriority !== 'ALL') p.set('priority', filterPriority)
      if (search) p.set('search', search)
      const r = await fetch(`/api/approvals?${p}`)
      if (!r.ok) throw new Error('Failed to load queue')
      const data = await r.json()
      setRequests(data.requests ?? [])
      setTotal(data.total ?? 0)
      if (data.capacity) setCapacity(data.capacity)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [session, page, filterStatus, filterPriority, search])

  useEffect(() => { loadCapacity() }, [loadCapacity])
  useEffect(() => { loadRequests() }, [loadRequests])

  function handleSearch(val: string) {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1) }, 350)
  }

  const actionable = requests.filter(r =>
    ['PENDING_APPROVAL', 'PARTIALLY_APPROVED', 'PARTIALLY_REJECTED'].includes(
      queue(r).approvalStatus
    )
  )

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === actionable.length && actionable.length > 0) setSelected(new Set())
    else setSelected(new Set(actionable.map(r => r.id)))
  }

  async function handleSingleAction(requestId: number, action: string, extraData?: Record<string, unknown>) {
    setActLoading(true)
    try {
      const r = await fetch(`/api/approvals/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extraData }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setModal(null)
      await Promise.all([loadRequests(), loadCapacity()])
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setActLoading(false)
    }
  }

  async function handleModalSubmit(data: {
    action: string; samples?: number; reason?: string
    dnaCapacity?: number; genoCapacity?: number
  }) {
    if (!modal) return

    if (data.action === 'edit_capacity') {
      setActLoading(true)
      try {
        const r1 = await fetch('/api/approvals/capacity', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceType: 'DNA_ISOLATION', capacity: data.dnaCapacity }),
        })
        if (!r1.ok) { const e = await r1.json(); throw new Error(`DNA Isolation: ${e.error ?? 'Update failed'}`) }

        const r2 = await fetch('/api/approvals/capacity', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceType: 'GENOTYPING', capacity: data.genoCapacity }),
        })
        if (!r2.ok) { const e = await r2.json(); throw new Error(`Genotyping: ${e.error ?? 'Update failed'}`) }

        setModal(null)
        await loadCapacity()
      } catch (e) {
        alert((e as Error).message)
      } finally {
        setActLoading(false)
      }
      return
    }

    if ('request' in modal) {
      await handleSingleAction((modal as { type: ModalType; request: ApprovalRequest }).request.id, data.action, {
        ...(data.samples != null ? { samples: data.samples } : {}),
        ...(data.reason  != null ? { reason:  data.reason  } : {}),
      })
    }
  }

  async function handleBulk(action: 'bulk_approve' | 'bulk_reject') {
    if (selected.size === 0) return
    if (!confirm(`${action === 'bulk_approve' ? 'Approve' : 'Reject'} ${selected.size} request(s)?`)) return
    setActLoading(true)
    try {
      const r = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, requestIds: Array.from(selected) }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setSelected(new Set())
      await Promise.all([loadRequests(), loadCapacity()])
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setActLoading(false)
    }
  }

  // ─── Styles ────────────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(226,232,240,0.8)', borderRadius: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 10px 40px rgba(15,23,42,0.06)',
    overflow: 'hidden',
  }
  const fS: React.CSSProperties = {
    padding: '7px 11px', fontSize: 13, borderRadius: 10,
    border: '1px solid rgba(209,213,219,0.8)',
    background: 'rgba(255,255,255,0.7)', color: '#374151', outline: 'none',
  }
  const lS: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  }

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: '#94a3b8', fontSize: 14 }}>
        Loading…
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .appr-row { transition: background 0.12s; }
        .appr-row:hover { background: rgba(204,251,241,0.35) !important; }
        input:focus, select:focus, textarea:focus {
          border-color: ${TEAL} !important;
          box-shadow: 0 0 0 3px rgba(20,184,166,0.12) !important;
        }
      `}</style>

      <ApprovalModal modal={modal} onClose={() => setModal(null)} onSubmit={handleModalSubmit} loading={actLoading} />

      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Page header ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 24, gap: 16, flexWrap: 'wrap',
        }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
              Approval Queue
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '5px 0 0' }}>
              {isAdmin
                ? 'Manage and approve genotyping requests before lab processing.'
                : isManagement
                ? 'Read-only view of the approval queue and capacity.'
                : isBreeder
                ? 'Track your submitted requests and approval status.'
                : 'View approved requests ready for lab processing.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {isAdmin && (
              <button onClick={() => setModal({ type: 'edit_capacity' })} style={{
                padding: '9px 18px', fontSize: 13, fontWeight: 600,
                border: `1.5px solid ${TEAL_BDR}`, borderRadius: 10,
                background: TEAL_LIGHT, color: TEAL_DARK, cursor: 'pointer',
              }}>
                ⚙ Edit Capacity
              </button>
            )}
            {isAdmin && selected.size > 0 && (
              <>
                <button onClick={() => handleBulk('bulk_approve')} disabled={actLoading} style={{
                  padding: '9px 18px', fontSize: 13, fontWeight: 700,
                  border: 'none', borderRadius: 10, cursor: 'pointer',
                  background: '#059669', color: '#fff',
                  boxShadow: '0 4px 14px rgba(5,150,105,0.3)',
                }}>✓ Approve {selected.size}</button>
                <button onClick={() => handleBulk('bulk_reject')} disabled={actLoading} style={{
                  padding: '9px 18px', fontSize: 13, fontWeight: 700,
                  border: 'none', borderRadius: 10, cursor: 'pointer',
                  background: '#dc2626', color: '#fff',
                  boxShadow: '0 4px 14px rgba(220,38,38,0.25)',
                }}>✗ Reject {selected.size}</button>
                <button onClick={() => setSelected(new Set())} style={{
                  fontSize: 12, color: '#64748b', background: 'none', border: 'none',
                  cursor: 'pointer', textDecoration: 'underline',
                }}>Clear</button>
              </>
            )}
          </div>
        </div>

        {/* ── Capacity cards ── */}
        {capacity && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {([
              { label: 'DNA Isolation', data: capacity.dnaIsolation, accent: TEAL,      bg: 'rgba(20,184,166,0.06)',  bdr: 'rgba(20,184,166,0.20)' },
              { label: 'Genotyping',    data: capacity.genotyping,    accent: '#6366f1', bg: 'rgba(99,102,241,0.06)', bdr: 'rgba(99,102,241,0.20)' },
            ] as const).map(({ label, data, accent, bg, bdr }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 16, padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <p style={{ fontWeight: 800, color: '#0f172a', fontSize: 15, margin: 0 }}>{label}</p>
                  <span style={{ fontSize: 12, color: accent, fontWeight: 700, background: `${accent}14`, padding: '2px 10px', borderRadius: 20 }}>
                    {pct(data.approvedThisWeek, data.weeklyCapacity)}% used
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {([
                    { l: 'Weekly Capacity',    v: data.weeklyCapacity.toLocaleString()    },
                    { l: 'Approved This Week', v: data.approvedThisWeek.toLocaleString()  },
                    { l: 'Remaining',          v: data.remainingCapacity.toLocaleString() },
                  ] as const).map(({ l, v }) => (
                    <div key={l} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '10px 12px' }}>
                      <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>{l}</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>{v}</p>
                    </div>
                  ))}
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.6)', borderRadius: 9, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct(data.approvedThisWeek, data.weeklyCapacity)}%`,
                    background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
                    borderRadius: 9, transition: 'width 0.4s ease',
                  }} />
                </div>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0', fontWeight: 500 }}>
                  Samples · Week of {new Date(capacity.weekStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ── Main table card ── */}
        <div style={card}>

          {/* Filter bar */}
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid rgba(241,245,249,0.9)',
            background: 'rgba(248,250,252,0.7)',
            display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lS}>Search</label>
              <input type="text" placeholder="Request or project code…"
                onChange={e => handleSearch(e.target.value)}
                style={{ ...fS, width: 200 }} />
            </div>

            {!isBreeder && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={lS}>Status</label>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }} style={fS}>
                  <option value="ALL">All Status</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="PARTIALLY_APPROVED">Partially Approved</option>
                  <option value="PARTIALLY_REJECTED">Partially Rejected</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lS}>Priority</label>
              <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(1) }} style={fS}>
                <option value="ALL">All Priorities</option>
                <option value="HIGH">High</option>
                <option value="NORMAL">Normal</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {(filterStatus !== 'ALL' || filterPriority !== 'ALL') && (
              <button onClick={() => { setFilterStatus('ALL'); setFilterPriority('ALL'); setPage(1) }}
                style={{ fontSize: 12, color: TEAL_DARK, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, paddingBottom: 2 }}>
                Clear filters
              </button>
            )}

            <div style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', alignSelf: 'center', fontWeight: 500 }}>
              {loading ? 'Loading…' : `${total} request${total !== 1 ? 's' : ''}`}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '12px 20px', background: 'rgba(254,242,242,0.9)', borderBottom: '1px solid rgba(252,165,165,0.4)', color: '#b91c1c', fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderTop: `3px solid ${TEAL}` }}>
                  {isAdmin && (
                    <QueueTH>
                      <input type="checkbox"
                        checked={selected.size === actionable.length && actionable.length > 0}
                        onChange={toggleAll}
                        style={{ accentColor: TEAL, width: 14, height: 14 }} />
                    </QueueTH>
                  )}
                  {!isBreeder && <QueueTH>Queue No.</QueueTH>}
                  <QueueTH>Project Code</QueueTH>
                  {!isBreeder && <QueueTH>Breeder</QueueTH>}
                  <QueueTH>Submitted</QueueTH>
                  <QueueTH>Actual Samples</QueueTH>
                  <QueueTH>Progress</QueueTH>
                  <QueueTH>Priority</QueueTH>
                  <QueueTH>Status</QueueTH>
                  {(isAdmin || isManagement) && <QueueTH>Approval Date</QueueTH>}
                  {isAdmin && <QueueTH right>Actions</QueueTH>}
                  {isBreeder && <QueueTH>Capacity</QueueTH>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                        style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block', marginBottom: 8 }}>
                        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity={0.25}/>
                        <path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/>
                      </svg>
                      <br />Loading queue…
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                      No requests in the approval queue.{' '}
                      {isBreeder && 'Submit a request to see it here.'}
                    </td>
                  </tr>
                ) : requests.map((r, i) => {
                  const q            = queue(r)
                  const isTerminal   = q.approvalStatus === 'APPROVED' || q.approvalStatus === 'REJECTED'
                  const isSelectable = !isTerminal
                  // FIX: use actual samples only — never fall back to predicted
                  const hasActual    = r.actualSamples !== null && r.actualSamples !== undefined
                  const remaining    = hasActual
                    ? (r.actualSamples! - q.approvedSamples - q.rejectedSamples)
                    : null
                  const rowBg        = i % 2 === 0 ? '#ffffff' : '#f8fafc'

                  return (
                    <tr key={r.id} className="appr-row"
                      style={{ borderBottom: '1px solid rgba(241,245,249,0.9)', background: rowBg }}>

                      {/* Checkbox */}
                      {isAdmin && (
                        <td style={{ padding: '12px 14px' }}>
                          {isSelectable && (
                            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)}
                              style={{ accentColor: TEAL, width: 14, height: 14 }} />
                          )}
                        </td>
                      )}

                      {/* Queue position */}
                      {!isBreeder && (
                        <td style={{ padding: '12px 14px', fontWeight: 700, fontSize: 13, color: isTerminal ? '#cbd5e1' : TEAL_DARK }}>
                          {q.queuePosition != null ? `#${q.queuePosition}` : '—'}
                        </td>
                      )}

                      {/* Project code — clickable link to internal request page */}
                      <td style={{ padding: '12px 14px' }}>
                        <Link href={`/requests/${r.id}`}
                          style={{ fontWeight: 700, color: '#0f766e', textDecoration: 'none', display: 'block' }}>
                          {r.projectCode ?? r.requestCode}
                        </Link>
                        <span style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginTop: 1 }}>
                          {r.sampleName}
                        </span>
                      </td>

                      {/* Breeder */}
                      {!isBreeder && (
                        <td style={{ padding: '12px 14px', color: '#475569', fontSize: 12 }}>
                          {r.submittedBy.name}
                        </td>
                      )}

                      {/* Submitted date */}
                      <td style={{ padding: '12px 14px', color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmt(r.submittedAt)}
                      </td>

                      {/* ── Actual Samples column ─────────────────────────────────────────
                           FIX: Show the true actualSamples value from the DB.
                           If null → show "Not Entered" with a link to the request page
                           so the breeder knows exactly where to fill it in.
                           NEVER fall back to predictedSamples here. */}
                      <td style={{ padding: '12px 14px' }}>
                        {hasActual ? (
                          <>
                            <span style={{ fontWeight: 700, color: '#1e293b', display: 'block' }}>
                              {r.actualSamples!.toLocaleString()}
                            </span>
                            <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>actual</span>
                            {remaining !== null && remaining > 0 && !isTerminal && (
                              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>
                                {remaining.toLocaleString()} pending
                              </div>
                            )}
                          </>
                        ) : (
                          <Link href={`/requests/${r.id}`} style={{ textDecoration: 'none' }}>
                            <span style={{
                              display: 'inline-block',
                              fontSize: 11, fontWeight: 600,
                              color: '#f59e0b',
                              background: 'rgba(254,243,199,0.8)',
                              border: '1px solid rgba(253,224,71,0.5)',
                              borderRadius: 6,
                              padding: '2px 8px',
                              cursor: 'pointer',
                            }}>
                              Not Entered
                            </span>
                            {r.predictedSamples !== null && (
                              <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                                pred: {r.predictedSamples.toLocaleString()}
                              </span>
                            )}
                          </Link>
                        )}
                      </td>

                      {/* Progress bar — only meaningful when actual samples exist */}
                      <td style={{ padding: '12px 14px' }}>
                        {hasActual ? (
                          <SampleBar
                            approved={q.approvedSamples}
                            rejected={q.rejectedSamples}
                            total={r.actualSamples!}
                          />
                        ) : (
                          <span style={{ fontSize: 11, color: '#cbd5e1', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td style={{ padding: '12px 14px' }}>
                        {isAdmin && !isTerminal ? (
                          <PrioritySelect requestId={r.id} current={q.approvalPriority} onChange={loadRequests} />
                        ) : (
                          <PriorityBadge priority={q.approvalPriority} />
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={q.approvalStatus} />
                        {q.rejectionReason && (
                          <div title={q.rejectionReason} style={{
                            fontSize: 10, color: '#f87171', marginTop: 2,
                            maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {q.rejectionReason}
                          </div>
                        )}
                      </td>

                      {/* Approval date */}
                      {(isAdmin || isManagement) && (
                        <td style={{ padding: '12px 14px', color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {fmt(q.approvalDate)}
                          {q.approvedBy && (
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{q.approvedBy.name}</div>
                          )}
                        </td>
                      )}

                      {/* Actions */}
                      {isAdmin && (
                        <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {!isTerminal ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {/* Approve / partial actions only available once actual samples are entered */}
                              {hasActual ? (
                                <>
                                  <button onClick={() => handleSingleAction(r.id, 'approve')} disabled={actLoading}
                                    style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, border: 'none', borderRadius: 7, cursor: 'pointer', background: '#059669', color: '#fff', opacity: actLoading ? 0.5 : 1 }}>
                                    ✓ Approve
                                  </button>
                                  <button onClick={() => setModal({ type: 'partial_approve', request: r })}
                                    style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, border: `1px solid ${TEAL_BDR}`, borderRadius: 7, cursor: 'pointer', background: TEAL_LIGHT, color: TEAL_DARK }}>
                                    Partial
                                  </button>
                                  <button onClick={() => setModal({ type: 'partial_reject', request: r })}
                                    style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, border: '1px solid rgba(251,191,36,0.4)', borderRadius: 7, cursor: 'pointer', background: 'rgba(254,243,199,0.6)', color: '#92400e' }}>
                                    Partial −
                                  </button>
                                </>
                              ) : (
                                <span style={{
                                  fontSize: 11, color: '#f59e0b', fontWeight: 600,
                                  background: 'rgba(254,243,199,0.6)',
                                  border: '1px solid rgba(253,224,71,0.4)',
                                  borderRadius: 7, padding: '5px 10px',
                                  whiteSpace: 'nowrap',
                                }}>
                                  Awaiting actual samples
                                </span>
                              )}
                              {/* Reject is always available */}
                              <button onClick={() => setModal({ type: 'reject', request: r })}
                                style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, border: '1px solid rgba(254,202,202,0.8)', borderRadius: 7, cursor: 'pointer', background: 'rgba(255,255,255,0.9)', color: '#dc2626' }}>
                                ✗ Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: '#cbd5e1', fontStyle: 'italic' }}>
                              {q.approvalStatus === 'APPROVED' ? 'Approved' : 'Rejected'}
                            </span>
                          )}
                        </td>
                      )}

                      {/* Breeder capacity note */}
                      {isBreeder && (
                        <td style={{ padding: '12px 14px', fontSize: 12 }}>
                          {capacity && q.approvalStatus === 'PENDING_APPROVAL' ? (
                            <div>
                              <div style={{ color: '#0f766e', fontWeight: 600, fontSize: 11 }}>
                                DNA: {capacity.dnaIsolation.remainingCapacity.toLocaleString()} samples
                              </div>
                              <div style={{ color: '#6366f1', fontWeight: 600, fontSize: 11, marginTop: 2 }}>
                                Geno: {capacity.genotyping.remainingCapacity.toLocaleString()} samples
                              </div>
                            </div>
                          ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', borderTop: '1px solid rgba(241,245,249,0.9)',
            background: 'rgba(248,250,252,0.5)',
          }}>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, fontWeight: 500 }}>
              Showing{' '}
              <strong style={{ color: '#374151' }}>
                {total === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)}
              </strong>{' '}of{' '}
              <strong style={{ color: '#374151' }}>{total}</strong>
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{
                padding: '6px 18px', border: '1px solid rgba(209,213,219,0.8)', borderRadius: 10, fontSize: 13,
                cursor: 'pointer', background: 'rgba(255,255,255,0.8)', color: '#374151', fontWeight: 500, opacity: page <= 1 ? 0.4 : 1,
              }}>← Prev</button>
              <button disabled={page * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} style={{
                padding: '6px 18px', border: '1px solid rgba(209,213,219,0.8)', borderRadius: 10, fontSize: 13,
                cursor: 'pointer', background: 'rgba(255,255,255,0.8)', color: '#374151', fontWeight: 500, opacity: page * PAGE_SIZE >= total ? 0.4 : 1,
              }}>Next →</button>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}