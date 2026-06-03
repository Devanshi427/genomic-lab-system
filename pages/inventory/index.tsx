import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'

// ─── Brand teal tokens ────────────────────────────────────────────────────────
const TEAL_ACCENT = '#14b8a6'                    // top bar
const TEAL_BORDER = '#99f6e4'                    // header bottom border
const TEAL_SEP    = 'rgba(153,246,228,0.55)'     // column separator pipes

// ─── Types ────────────────────────────────────────────────────────────────────

type InventoryItem = {
  id: number
  name: string
  brand: string | null
  category: string
  type: string
  quantity: number
  unit: string
  minThreshold: number
  expiryDate: string | null
  manufacturingDate: string | null
  notes: string | null
  isLow: boolean
  isExpiringSoon: boolean
  lab: { id: number; name: string }
}

type InventoryAlert = {
  id: number
  name: string
  quantity: number
  unit: string
  labName: string
  type: 'LOW_STOCK' | 'EXPIRY'
  detail: string
}

type Lab = { id: number; name: string }

type AddItemForm = {
  name: string; brand: string; category: string; type: string
  quantity: string; unit: string; minThreshold: string
  expiryDate: string; manufacturingDate: string; labId: string; notes: string
}

const EMPTY_FORM: AddItemForm = {
  name: '', brand: '', category: '', type: 'CHEMICAL',
  quantity: '', unit: '', minThreshold: '10',
  expiryDate: '', manufacturingDate: '', labId: '', notes: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconPlus = () => (
  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
)

const IconSearch = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
)

const IconFilter = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
  </svg>
)

const IconAlert = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
)

const IconSpinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
    style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>
    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity={0.25} />
    <path d="M21 12a9 9 0 00-9-9" strokeLinecap="round" />
  </svg>
)

const IconTransfer = () => (
  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
)

const IconChevronDown = ({ rotated }: { rotated: boolean }) => (
  <svg
    width="14" height="14" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" strokeWidth={2.5}
    style={{
      transition: 'transform 0.25s ease',
      transform: rotated ? 'rotate(180deg)' : 'rotate(0deg)',
      flexShrink: 0,
    }}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

// ─── Shared form field style ──────────────────────────────────────────────────

const iS: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #e2e8f0', borderRadius: 10,
  padding: '9px 12px', fontSize: 13, color: '#1e293b',
  background: 'rgba(255,255,255,0.8)',
  outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
}

const lS: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: '#98a2b3', textTransform: 'uppercase',
  letterSpacing: '0.12em', marginBottom: 6,
}

// ─── Item form (shared add / edit) ────────────────────────────────────────────

function ItemForm({
  form, setForm, onSubmit, onCancel, saving, error, submitLabel, labs,
}: {
  form: AddItemForm
  setForm: (f: AddItemForm) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  saving: boolean
  error: string
  submitLabel: string
  labs: Lab[]
}) {
  return (
    <form onSubmit={onSubmit}>
      {error && (
        <div style={{
          background: 'rgba(254,242,242,0.9)', border: '1px solid rgba(252,165,165,0.5)',
          borderRadius: 10, padding: '10px 14px',
          color: '#b91c1c', fontSize: 13, marginBottom: 18,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={lS}>Material Name <span style={{ color: '#ef4444' }}>*</span></label>
          <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Taq DNA Polymerase" style={iS} />
        </div>
        <div>
          <label style={lS}>Brand / Supplier</label>
          <input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}
            placeholder="e.g. Sigma, Thermo Fisher" style={iS} />
        </div>
        <div>
          <label style={lS}>Category <span style={{ color: '#ef4444' }}>*</span></label>
          <input required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
            placeholder="e.g. Buffer, Enzyme" style={iS} />
        </div>
        <div>
          <label style={lS}>Type</label>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={iS}>
            <option value="CHEMICAL">🧪 Chemical</option>
            <option value="CONSUMABLE">🧴 Consumable</option>
          </select>
        </div>
        <div>
          <label style={lS}>Lab <span style={{ color: '#ef4444' }}>*</span></label>
          <select required value={form.labId} onChange={e => setForm({ ...form, labId: e.target.value })} style={iS}>
            <option value="">Select lab…</option>
            {labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lS}>Available Qty <span style={{ color: '#ef4444' }}>*</span></label>
          <input required type="number" step="0.01" min="0" value={form.quantity}
            onChange={e => setForm({ ...form, quantity: e.target.value })} style={iS} />
        </div>
        <div>
          <label style={lS}>Unit <span style={{ color: '#ef4444' }}>*</span></label>
          <input required value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
            placeholder="mL, g, units…" style={iS} />
        </div>
        <div>
          <label style={lS}>Min Threshold</label>
          <input type="number" step="0.01" min="0" value={form.minThreshold}
            onChange={e => setForm({ ...form, minThreshold: e.target.value })} style={iS} />
        </div>
        <div>
          <label style={lS}>Mfg Date</label>
          <input type="date" value={form.manufacturingDate}
            onChange={e => setForm({ ...form, manufacturingDate: e.target.value })} style={iS} />
        </div>
        <div>
          <label style={lS}>Expiry Date</label>
          <input type="date" value={form.expiryDate}
            onChange={e => setForm({ ...form, expiryDate: e.target.value })} style={iS} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={lS}>Notes</label>
          <textarea rows={2} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            style={{ ...iS, resize: 'vertical' }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button type="button" onClick={onCancel}
          style={{
            padding: '9px 20px', fontSize: 13, fontWeight: 600,
            border: '1px solid rgba(209,213,219,0.8)', borderRadius: 10,
            cursor: 'pointer', background: 'rgba(255,255,255,0.8)', color: '#374151',
          }}>
          Cancel
        </button>
        <button type="submit" disabled={saving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 24px', fontSize: 13, fontWeight: 700,
            border: 'none', borderRadius: 10,
            cursor: saving ? 'not-allowed' : 'pointer',
            background: saving
              ? 'rgba(20,184,166,0.4)'
              : 'linear-gradient(135deg, #0f9f8f 0%, #14b8a6 100%)',
            color: '#fff',
            boxShadow: saving ? 'none' : '0 4px 14px rgba(20,184,166,0.28)',
          }}>
          {saving && <IconSpinner />}
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

// ─── Collapsible Alert Summary ────────────────────────────────────────────────

function AlertSummary({ alerts }: { alerts: InventoryAlert[] }) {
  const [expanded, setExpanded] = useState(false)

  if (alerts.length === 0) return null

  const lowCount     = alerts.filter(a => a.type === 'LOW_STOCK').length
  const expiryCount  = alerts.filter(a => a.type === 'EXPIRY').length
  const hasLow       = lowCount > 0
  const hasExpiry    = expiryCount > 0

  return (
    <div style={{ marginBottom: 16 }}>
      {/* ── Summary pill row ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}>
        {/* Low stock pill */}
        {hasLow && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '7px 14px',
            background: 'rgba(254,252,232,0.95)',
            border: '1px solid rgba(253,224,71,0.55)',
            borderRadius: 10,
            fontSize: 13, fontWeight: 600, color: '#713f12',
          }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>⚠️</span>
            <span>{lowCount} item{lowCount !== 1 ? 's' : ''} below minimum stock</span>
          </div>
        )}

        {/* Expired pill */}
        {hasExpiry && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '7px 14px',
            background: 'rgba(254,242,242,0.95)',
            border: '1px solid rgba(252,165,165,0.5)',
            borderRadius: 10,
            fontSize: 13, fontWeight: 600, color: '#b91c1c',
          }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>🔴</span>
            <span>{expiryCount} expired / expiring soon</span>
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px',
            background: expanded ? 'rgba(20,184,166,0.10)' : 'rgba(255,255,255,0.82)',
            border: `1px solid ${expanded ? 'rgba(20,184,166,0.30)' : 'rgba(209,213,219,0.8)'}`,
            borderRadius: 10,
            fontSize: 13, fontWeight: 600,
            color: expanded ? '#0d9488' : '#374151',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={e => {
            if (!expanded) {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(20,184,166,0.06)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(20,184,166,0.25)'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#0d9488'
            }
          }}
          onMouseLeave={e => {
            if (!expanded) {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.82)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(209,213,219,0.8)'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#374151'
            }
          }}
        >
          {expanded ? 'Hide Details' : 'View Details'}
          <IconChevronDown rotated={expanded} />
        </button>
      </div>

      {/* ── Expanded detail list ── */}
      {expanded && (
        <div style={{
          marginTop: 10,
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(226,232,240,0.8)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
          // Max height with scroll so large alert lists don't dominate the page
          maxHeight: 320,
          overflowY: 'auto',
        }}>
          {/* Expiry alerts first (more urgent) */}
          {alerts
            .slice()
            .sort((a, b) => {
              // EXPIRY before LOW_STOCK
              if (a.type !== b.type) return a.type === 'EXPIRY' ? -1 : 1
              return 0
            })
            .map((alert, idx) => {
              const isExpiry = alert.type === 'EXPIRY'
              return (
                <div
                  key={`${alert.id}-${alert.type}`}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 16px',
                    borderBottom: idx < alerts.length - 1
                      ? '1px solid rgba(241,245,249,0.9)'
                      : 'none',
                    background: isExpiry
                      ? 'rgba(254,242,242,0.45)'
                      : 'transparent',
                    fontSize: 13,
                  }}
                >
                  {/* Type icon */}
                  <span style={{
                    flexShrink: 0,
                    marginTop: 1,
                    color: isExpiry ? '#dc2626' : '#ca8a04',
                  }}>
                    <IconAlert />
                  </span>

                  {/* Label */}
                  <span style={{
                    fontWeight: 600,
                    color: isExpiry ? '#b91c1c' : '#713f12',
                    whiteSpace: 'nowrap',
                    marginRight: 4,
                  }}>
                    {isExpiry ? 'Expiry:' : 'Low Stock:'}
                  </span>

                  {/* Name + lab + detail */}
                  <span style={{ color: '#374151', flex: 1, lineHeight: 1.4 }}>
                    <strong style={{ color: '#0f172a' }}>{alert.name}</strong>
                    {' '}
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>({alert.labName})</span>
                    {' — '}
                    <span style={{ color: isExpiry ? '#dc2626' : '#92400e' }}>{alert.detail}</span>
                  </span>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [items, setItems]           = useState<InventoryItem[]>([])
  const [alerts, setAlerts]         = useState<InventoryAlert[]>([])
  const [labs, setLabs]             = useState<Lab[]>([])
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [filterLabId,    setFilterLabId]    = useState('ALL')
  const [filterType,     setFilterType]     = useState('ALL')
  const [filterCategory, setFilterCategory] = useState('ALL')
  const [filterAlert,    setFilterAlert]    = useState('ALL')
  const [search,         setSearch]         = useState('')

  const [showAdd,   setShowAdd]   = useState(false)
  const [addForm,   setAddForm]   = useState<AddItemForm>(EMPTY_FORM)
  const [addSaving, setAddSaving] = useState(false)
  const [addError,  setAddError]  = useState('')

  const [editId,     setEditId]     = useState<number | null>(null)
  const [editForm,   setEditForm]   = useState<AddItemForm>(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)
  const [editError,  setEditError]  = useState('')

  const role         = (session?.user as Record<string, unknown>)?.role as string || 'GUEST'
  const canManage    = role === 'INVENTORY_MANAGER' || role === 'ADMIN'
  const canSeeAlerts = role === 'INVENTORY_MANAGER' || role === 'ADMIN'
  const isReadOnly   = role === 'MANAGEMENT'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const loadItems = useCallback(() => {
    setLoadError('')
    fetch('/api/inventory')
      .then(r => { if (!r.ok) throw new Error(`Server error ${r.status}`); return r.json() })
      .then((data: InventoryItem[]) => { setItems(Array.isArray(data) ? data : []); setLoading(false) })
      .catch((err: Error) => { setLoadError(err.message || 'Failed to load inventory'); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetch('/api/inventory')
      .then(r => { if (!r.ok) throw new Error(`Server error ${r.status}`); return r.json() })
      .then((data: InventoryItem[]) => {
        if (cancelled) return
        setItems(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setLoadError(err.message || 'Failed to load inventory')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [session])

  useEffect(() => {
    if (!session) return
    fetch('/api/labs').then(r => r.json()).then((d: Lab[]) => setLabs(Array.isArray(d) ? d : [])).catch(() => {})
  }, [session])

  useEffect(() => {
    if (!session || !canSeeAlerts) return
    fetch('/api/inventory/alerts').then(r => r.json()).then((d: InventoryAlert[]) => setAlerts(Array.isArray(d) ? d : [])).catch(() => {})
  }, [session, canSeeAlerts])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setAddSaving(true); setAddError('')
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name, brand: addForm.brand || null,
          category: addForm.category, type: addForm.type,
          quantity: parseFloat(addForm.quantity), unit: addForm.unit,
          minThreshold: parseFloat(addForm.minThreshold),
          expiryDate: addForm.expiryDate || null,
          manufacturingDate: addForm.manufacturingDate || null,
          labId: parseInt(addForm.labId), notes: addForm.notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowAdd(false); setAddForm(EMPTY_FORM); loadItems()
    } catch (e: unknown) { setAddError(e instanceof Error ? e.message : 'Failed to add item') }
    finally { setAddSaving(false) }
  }

  function startEdit(item: InventoryItem) {
    setEditId(item.id)
    setEditForm({
      name: item.name, brand: item.brand ?? '', category: item.category,
      type: item.type, quantity: String(item.quantity), unit: item.unit,
      minThreshold: String(item.minThreshold),
      expiryDate: item.expiryDate ? item.expiryDate.split('T')[0] : '',
      manufacturingDate: item.manufacturingDate ? item.manufacturingDate.split('T')[0] : '',
      labId: String(item.lab.id), notes: item.notes ?? '',
    })
    setEditError('')
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    setEditSaving(true); setEditError('')
    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editId, name: editForm.name, brand: editForm.brand || null,
          category: editForm.category, type: editForm.type,
          quantity: parseFloat(editForm.quantity), unit: editForm.unit,
          minThreshold: parseFloat(editForm.minThreshold),
          expiryDate: editForm.expiryDate || null,
          manufacturingDate: editForm.manufacturingDate || null,
          notes: editForm.notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEditId(null); loadItems()
    } catch (e: unknown) { setEditError(e instanceof Error ? e.message : 'Failed to update item') }
    finally { setEditSaving(false) }
  }

  if (status === 'loading' || loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 240 }}>
      <div style={{ textAlign: 'center' }}>
        <IconSpinner />
        <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 12 }}>Loading inventory…</p>
      </div>
    </div>
  )

  if (loadError) return (
    <div style={{ padding: 24 }}>
      <div style={{
        background: 'rgba(254,242,242,0.9)', border: '1px solid rgba(252,165,165,0.5)',
        borderRadius: 14, padding: '16px 20px', color: '#b91c1c',
      }}>
        <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Failed to load inventory</p>
        <p style={{ fontSize: 13, margin: 0 }}>{loadError}</p>
        <button onClick={() => { setLoading(true); loadItems() }}
          style={{ marginTop: 10, fontSize: 13, color: '#0f9f8f', background: 'none', border: 'none', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    </div>
  )

  const hasFilters = filterLabId !== 'ALL' || filterType !== 'ALL' || filterCategory !== 'ALL' || filterAlert !== 'ALL' || !!search

  const filtered = items.filter(item => {
    if (filterLabId !== 'ALL' && String(item.lab.id) !== filterLabId) return false
    if (filterType !== 'ALL' && item.type !== filterType) return false
    if (filterCategory !== 'ALL' && item.category !== filterCategory) return false
    if (filterAlert === 'LOW' && !item.isLow) return false
    if (filterAlert === 'EXPIRING' && !item.isExpiringSoon) return false
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) &&
        !(item.brand ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // ── Table column headers ──────────────────────────────────────────────────
  const headerCols = [
    'Material', 'Brand', 'Type', 'Lab', 'Available Qty', 'Unit',
    'Mfg Date', 'Expiry Date', 'Status',
    ...(canManage ? ['Actions'] : []),
  ]

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .inv-row { transition: background 0.15s; }
        .inv-row:hover { background: rgba(204,251,241,0.35) !important; }
        .inv-row-selected { background: #f3fcf8 !important; border-left: 3px solid ${TEAL_ACCENT} !important; }
        .inv-row-selected:hover { background: #edfdf5 !important; }
      `}</style>

      <div style={{
        width: '100%',
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '32px 28px 48px',
      }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', margin: 0 }}>
                Inventory
              </h1>
              {isReadOnly && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px',
                  background: 'rgba(241,245,249,0.9)', color: '#64748b',
                  borderRadius: 20, border: '1px solid #e2e8f0',
                }}>
                  Read Only
                </span>
              )}
            </div>
            <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 6, marginBottom: 0 }}>
              {filtered.length} of {items.length} items
              {items.length > 0 && (
                <span style={{ marginLeft: 8, color: '#cbd5e1' }}>·</span>
              )}
              {items.length > 0 && (
                <span style={{ marginLeft: 8 }}>
                  {filtered.filter(i => i.type === 'CHEMICAL').length} chemicals · {filtered.filter(i => i.type === 'CONSUMABLE').length} consumables
                </span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/inventory/clusters" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', fontSize: 13, fontWeight: 600,
              border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12,
              color: '#6366f1', background: 'rgba(238,242,255,0.6)',
              textDecoration: 'none', transition: 'all 0.15s',
            }}>
              ⚗ Consumption Clusters
            </Link>

            {canManage && (
              <Link href="/inventory/new" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', fontSize: 13, fontWeight: 700,
                border: 'none', borderRadius: 12, cursor: 'pointer',
                background: 'linear-gradient(135deg, #0f9f8f 0%, #14b8a6 100%)',
                color: '#fff', textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(20,184,166,0.28)',
              }}>
                <IconPlus /> Add Item
              </Link>
            )}
          </div>
        </div>

        {/* ── Collapsible Alert Summary (replaces flat banner list) ── */}
        {canSeeAlerts && (
          alerts.length === 0 ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '7px 14px', marginBottom: 16,
              background: 'rgba(209,250,229,0.7)',
              border: '1px solid rgba(52,211,153,0.35)',
              borderRadius: 10,
              fontSize: 13, fontWeight: 600, color: '#065f46',
            }}>
              <span style={{ fontSize: 15 }}>✓</span>
              No inventory alerts — all stock levels are healthy
            </div>
          ) : (
            <AlertSummary alerts={alerts} />
          )
        )}

        {/* ── Add item panel ── */}
        {showAdd && canManage && (
          <div style={{
            background: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.5)',
            borderRadius: 20, boxShadow: '0 8px 30px rgba(15,23,42,0.07)',
            padding: '24px 28px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Add New Item</h2>
              <button onClick={() => { setShowAdd(false); setAddForm(EMPTY_FORM) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20, lineHeight: 1 }}>
                ×
              </button>
            </div>
            <ItemForm
              form={addForm} setForm={setAddForm}
              onSubmit={handleAdd} onCancel={() => { setShowAdd(false); setAddForm(EMPTY_FORM) }}
              saving={addSaving} error={addError} submitLabel="Add Item" labs={labs}
            />
          </div>
        )}

        {/* ── Filters ── */}
        <div style={{
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: 16, boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
          padding: '16px 20px', marginBottom: 16,
          display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end',
        }}>
          <div>
            <label style={lS}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconSearch /> Search</span>
            </label>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Name or brand…"
              style={{ ...iS, width: 180 }} />
          </div>
          <div>
            <label style={lS}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconFilter /> Type</span></label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...iS, width: 140 }}>
              <option value="ALL">All Types</option>
              <option value="CHEMICAL">🧪 Chemical</option>
              <option value="CONSUMABLE">🧴 Consumable</option>
            </select>
          </div>
          <div>
            <label style={lS}>Lab</label>
            <select value={filterLabId} onChange={e => setFilterLabId(e.target.value)} style={{ ...iS, width: 140 }}>
              <option value="ALL">All Labs</option>
              {labs.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lS}>Alert</label>
            <select value={filterAlert} onChange={e => setFilterAlert(e.target.value)} style={{ ...iS, width: 140 }}>
              <option value="ALL">All Items</option>
              <option value="LOW">Low Stock</option>
              <option value="EXPIRING">Expiring Soon</option>
            </select>
          </div>
          {hasFilters && (
            <button
              onClick={() => { setFilterLabId('ALL'); setFilterType('ALL'); setFilterCategory('ALL'); setFilterAlert('ALL'); setSearch('') }}
              style={{ fontSize: 12, color: '#0f9f8f', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, paddingBottom: 2 }}>
              Clear filters
            </button>
          )}
        </div>

        {/* ── Inventory table ── */}
        <div style={{
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: 20, boxShadow: '0 8px 30px rgba(15,23,42,0.05)',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              minWidth: '1450px',
              borderCollapse: 'collapse',
              fontSize: 13,
            }}>
              {/* ── Headers ── */}
              <thead>
                <tr style={{
                  background: 'rgba(248,250,252,0.9)',
                  borderTop: `3px solid ${TEAL_ACCENT}`,
                  borderBottom: `1px solid ${TEAL_BORDER}`,
                }}>
                  {headerCols.map((h, i) => (
                    <th key={h} style={{
                      padding: '12px 16px',
                      textAlign: i === 4 ? 'right' : 'left',
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#98a2b3',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      whiteSpace: 'nowrap',
                      borderRight: i < headerCols.length - 1 ? `1px solid ${TEAL_SEP}` : undefined,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* ── Rows ── */}
              <tbody>
                {filtered.map((item, rowIdx) => {
                  const isSelected = selectedId === item.id
                  const zebraBg    = rowIdx % 2 === 0 ? '#ffffff' : '#fbfdfc'
                  const rowClass   = ['inv-row', isSelected ? 'inv-row-selected' : ''].filter(Boolean).join(' ')

                  return (
                    <>
                      <tr
                        key={item.id}
                        className={rowClass}
                        onClick={() => setSelectedId(isSelected ? null : item.id)}
                        style={{
                          borderBottom: '1px solid #eef2f1',
                          background: item.isLow && !isSelected ? 'rgba(254,242,242,0.4)' : zebraBg,
                          cursor: 'pointer',
                        }}
                      >
                        {/* Material */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#0f766e', letterSpacing: '-0.01em' }}>
                            {item.name}
                          </div>
                          {item.notes && (
                            <div style={{ fontSize: 12, color: '#667085', marginTop: 2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.notes}
                            </div>
                          )}
                        </td>

                        {/* Brand */}
                        <td style={{ padding: '14px 16px', color: item.brand ? '#667085' : '#cbd5e1', fontSize: 13 }}>
                          {item.brand || '—'}
                        </td>

                        {/* Type */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center',
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: item.type === 'CHEMICAL' ? 'rgba(237,233,254,0.8)' : 'rgba(204,251,241,0.8)',
                            color: item.type === 'CHEMICAL' ? '#6d28d9' : '#0f766e',
                          }}>
                            {item.type === 'CHEMICAL' ? '🧪 Chemical' : '🧴 Consumable'}
                          </span>
                        </td>

                        {/* Lab */}
                        <td style={{ padding: '14px 16px', color: '#667085', fontSize: 13 }}>
                          {item.lab.name}
                        </td>

                        {/* Qty */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, color: item.isLow ? '#dc2626' : '#1e293b' }}>
                            {item.quantity}
                          </span>
                          {item.isLow && (
                            <div style={{ fontSize: 10, color: '#f87171', marginTop: 1 }}>min: {item.minThreshold}</div>
                          )}
                        </td>

                        {/* Unit */}
                        <td style={{ padding: '14px 16px', color: '#667085', fontSize: 13 }}>
                          {item.unit}
                        </td>

                        {/* Mfg Date */}
                        <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {fmtDate(item.manufacturingDate)}
                        </td>

                        {/* Expiry Date */}
                        <td style={{ padding: '14px 16px', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {item.expiryDate ? (
                            <span style={{ color: item.isExpiringSoon ? '#ea580c' : '#667085', fontWeight: item.isExpiringSoon ? 600 : 400 }}>
                              {fmtDate(item.expiryDate)} {item.isExpiringSoon && '⚠'}
                            </span>
                          ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {item.isLow && (
                              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(254,226,226,0.8)', color: '#dc2626' }}>Low</span>
                            )}
                            {item.isExpiringSoon && (
                              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(255,237,213,0.8)', color: '#c2410c' }}>Expiring</span>
                            )}
                            {!item.isLow && !item.isExpiringSoon && (
                              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(204,251,241,0.6)', color: '#0f766e' }}>OK</span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        {canManage && (
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                onClick={e => { e.stopPropagation(); startEdit(item) }}
                                style={{
                                  fontSize: 12, fontWeight: 600, padding: '5px 12px',
                                  border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8,
                                  cursor: 'pointer', color: '#6366f1',
                                  background: 'rgba(238,242,255,0.6)', transition: 'all 0.12s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(238,242,255,0.95)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(238,242,255,0.6)')}>
                                Edit
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); router.push(`/inventory/transfer?fromItemId=${item.id}`) }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  fontSize: 12, fontWeight: 600, padding: '5px 12px',
                                  border: '1px solid #eef2f1', borderRadius: 8,
                                  cursor: 'pointer', color: '#667085',
                                  background: '#fbfdfc', transition: 'all 0.12s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#f6fbf9')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#fbfdfc')}>
                                <IconTransfer /> Transfer
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* Inline edit row */}
                      {editId === item.id && (
                        <tr key={`edit-${item.id}`}>
                          <td colSpan={canManage ? 10 : 9} style={{ padding: '0 16px 16px' }}>
                            <div style={{
                              background: 'rgba(248,250,252,0.9)',
                              border: '1px solid rgba(20,184,166,0.2)',
                              borderRadius: 14, padding: '20px 24px',
                            }}>
                              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>
                                Edit: {item.name}
                              </h3>
                              <ItemForm
                                form={editForm} setForm={setEditForm}
                                onSubmit={handleEdit} onCancel={() => setEditId(null)}
                                saving={editSaving} error={editError} submitLabel="Save Changes" labs={labs}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div style={{ padding: '56px 24px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
                <p style={{ fontSize: 14, margin: 0 }}>
                  {items.length === 0 ? 'No inventory items yet. Click "Add Item" to get started.' : 'No items match your filters.'}
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  )
}