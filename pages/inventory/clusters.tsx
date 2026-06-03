// pages/inventory/clusters.tsx
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

type ClusterItem = {
  id: number
  itemId: number
  qtyPerUnit: number
  item: {
    id: number
    name: string
    unit: string
    quantity: number
    type: string
    lab: { name: string }
  }
}

type Cluster = {
  id: number
  name: string
  description: string | null
  unit: string
  experiment: { id: number; name: string } | null
  items: ClusterItem[]
  _count?: { deductions: number }
}

type InventoryItem = {
  id: number
  name: string
  unit: string
  quantity: number
  type: string
  lab: { name: string }
}

type Experiment = { id: number; name: string }

type DeductResult = {
  ok: boolean
  cluster: string
  units: number
  deducted: Array<{ name: string; deducted: number; unit: string; remaining: number }>
}

type NewClusterItem = { itemId: string; qtyPerUnit: string }

const EMPTY_CLUSTER = { name: '', description: '', unit: 'sample', experimentId: '' }

// ── Style helpers ─────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid rgba(209,213,219,0.8)',
  borderRadius: 8,
  padding: '7px 11px',
  fontSize: 13,
  color: '#374151',
  outline: 'none',
  background: 'rgba(255,255,255,0.9)',
  boxSizing: 'border-box',
}

// ── ClusterRowEditor ──────────────────────────────────────────────────────────
type ClusterRowEditorProps = {
  rows: NewClusterItem[]
  items: InventoryItem[]
  unitLabel: string
  onAddRow: () => void
  onRemoveRow: (idx: number) => void
  onUpdateRow: (idx: number, field: keyof NewClusterItem, val: string) => void
}

function ClusterRowEditor({ rows, items, unitLabel, onAddRow, onRemoveRow, onUpdateRow }: ClusterRowEditorProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ ...labelStyle, margin: 0 }}>
          Items consumed per {unitLabel || 'sample'}
        </p>
        <button
          type="button"
          onClick={onAddRow}
          style={{
            fontSize: 12, color: '#3b82f6', background: 'none',
            border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0,
          }}
        >
          + Add row
        </button>
      </div>
      <div style={{
        border: '1px solid rgba(226,232,240,0.8)',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.9)',
      }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
              {['Material', `Qty / ${unitLabel || 'sample'}`, 'Unit', 'In Stock', '', ''].map((h, i) => (
                <th key={i} style={{
                  padding: '9px 14px',
                  textAlign: i === 3 ? 'right' : 'left',
                  fontSize: 11, fontWeight: 700, color: '#64748b',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const selItem = items.find(i => String(i.id) === row.itemId)
              return (
                <tr key={idx} style={{
                  borderBottom: idx < rows.length - 1 ? '1px solid rgba(241,245,249,0.9)' : 'none',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(248,250,252,0.4)',
                }}>
                  <td style={{ padding: '8px 14px' }}>
                    <select
                      value={row.itemId}
                      onChange={e => onUpdateRow(idx, 'itemId', e.target.value)}
                      style={{ ...inputStyle, width: '100%' }}
                    >
                      <option value="">Select item…</option>
                      {items.map(item => (
                        <option key={item.id} value={item.id}>
                          [{item.type === 'CHEMICAL' ? 'Chem' : 'Cons'}] {item.name} ({item.lab.name})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '8px 14px' }}>
                    <input
                      type="number" step="any" min="0"
                      value={row.qtyPerUnit}
                      onChange={e => onUpdateRow(idx, 'qtyPerUnit', e.target.value)}
                      style={{ ...inputStyle, width: 100 }}
                    />
                  </td>
                  <td style={{ padding: '8px 14px', fontSize: 12, color: '#94a3b8' }}>
                    {selItem?.unit || '—'}
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                    {selItem ? (
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: selItem.quantity < (parseFloat(row.qtyPerUnit) || 0) ? '#dc2626' : '#374151',
                      }}>
                        {selItem.quantity}
                      </span>
                    ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '8px 14px', fontSize: 12, color: '#94a3b8' }}>
                    {selItem?.unit || ''}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveRow(idx)}
                        style={{
                          background: 'none', border: 'none',
                          color: '#f87171', cursor: 'pointer', fontSize: 14, padding: 0,
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
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
      <p style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{sub}</p>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ClustersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [clusters, setClusters]       = useState<Cluster[]>([])
  const [items, setItems]             = useState<InventoryItem[]>([])
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading]         = useState(true)

  const [showCreate, setShowCreate]     = useState(false)
  const [clusterForm, setClusterForm]   = useState(EMPTY_CLUSTER)
  const [clusterRows, setClusterRows]   = useState<NewClusterItem[]>([{ itemId: '', qtyPerUnit: '' }])
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError]   = useState('')

  const [editClusterId, setEditClusterId] = useState<number | null>(null)
  const [editForm, setEditForm]           = useState(EMPTY_CLUSTER)
  const [editRows, setEditRows]           = useState<NewClusterItem[]>([])
  const [editSaving, setEditSaving]       = useState(false)
  const [editError, setEditError]         = useState('')

  const [deductCluster, setDeductCluster]         = useState<Cluster | null>(null)
  const [deductUnits, setDeductUnits]             = useState('')
  const [deductProjectCode, setDeductProjectCode] = useState('')
  const [, setDeductResolvedRequestId]            = useState<number | null>(null)
  const [deducting, setDeducting]                 = useState(false)
  const [deductError, setDeductError]             = useState('')
  const [deductResult, setDeductResult]           = useState<DeductResult | null>(null)

  const role = (session?.user as Record<string, unknown>)?.role as string
  const canManage = role === 'INVENTORY_MANAGER' || role === 'ADMIN'

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    const allowed = ['ADMIN', 'INVENTORY_MANAGER', 'BIOTECHNOLOGIST']
    if (status === 'authenticated' && !allowed.includes(role)) router.push('/inventory')
  }, [session, status, role, router])

  const loadClusters = useCallback(() => {
    fetch('/api/inventory/clusters')
      .then(r => r.json())
      .then(data => { setClusters(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!session) return
    loadClusters()
    fetch('/api/inventory').then(r => r.json()).then(data => setItems(Array.isArray(data) ? data : [])).catch(() => {})
    fetch('/api/experiments').then(r => r.json()).then(data => setExperiments(Array.isArray(data) ? data : [])).catch(() => {})
  }, [session, loadClusters])

  function makeAddRow(rows: NewClusterItem[], setRows: (r: NewClusterItem[]) => void) {
    return () => setRows([...rows, { itemId: '', qtyPerUnit: '' }])
  }
  function makeRemoveRow(rows: NewClusterItem[], setRows: (r: NewClusterItem[]) => void) {
    return (idx: number) => setRows(rows.filter((_, i) => i !== idx))
  }
  function makeUpdateRow(rows: NewClusterItem[], setRows: (r: NewClusterItem[]) => void) {
    return (idx: number, field: keyof NewClusterItem, val: string) => {
      const next = [...rows]; next[idx] = { ...next[idx], [field]: val }; setRows(next)
    }
  }

  async function handleReorder(clusterId: number, direction: 'up' | 'down') {
    const idx = clusters.findIndex(c => c.id === clusterId)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= clusters.length) return

    const reordered = [...clusters]
    ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]

    // Optimistic update
    setClusters(reordered)

    const updates = reordered.map((c, i) => ({ id: c.id, sortOrder: i }))
    try {
      await fetch('/api/inventory/clusters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
    } catch {
      // Revert on failure
      loadClusters()
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateSaving(true); setCreateError('')
    const validRows = clusterRows.filter(r => r.itemId && r.qtyPerUnit)
    if (validRows.length === 0) { setCreateError('Add at least one item'); setCreateSaving(false); return }
    try {
      const res = await fetch('/api/inventory/clusters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clusterForm.name,
          description: clusterForm.description || null,
          unit: clusterForm.unit,
          experimentId: clusterForm.experimentId ? parseInt(clusterForm.experimentId) : null,
          items: validRows.map(r => ({ itemId: parseInt(r.itemId), qtyPerUnit: parseFloat(r.qtyPerUnit) }))
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowCreate(false)
      setClusterForm(EMPTY_CLUSTER)
      setClusterRows([{ itemId: '', qtyPerUnit: '' }])
      loadClusters()
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create cluster')
    } finally { setCreateSaving(false) }
  }

  function startEdit(c: Cluster) {
    setEditClusterId(c.id)
    setEditForm({ name: c.name, description: c.description ?? '', unit: c.unit, experimentId: c.experiment ? String(c.experiment.id) : '' })
    setEditRows(c.items.map(ci => ({ itemId: String(ci.itemId), qtyPerUnit: String(ci.qtyPerUnit) })))
    setEditError('')
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editClusterId) return
    setEditSaving(true); setEditError('')
    const validRows = editRows.filter(r => r.itemId && r.qtyPerUnit)
    if (validRows.length === 0) { setEditError('Add at least one item'); setEditSaving(false); return }
    try {
      const res = await fetch(`/api/inventory/clusters/${editClusterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name, description: editForm.description || null, unit: editForm.unit,
          experimentId: editForm.experimentId ? parseInt(editForm.experimentId) : null,
          items: validRows.map(r => ({ itemId: parseInt(r.itemId), qtyPerUnit: parseFloat(r.qtyPerUnit) }))
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEditClusterId(null)
      loadClusters()
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : 'Failed to update')
    } finally { setEditSaving(false) }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete cluster "${name}"? This cannot be undone.`)) return
    await fetch(`/api/inventory/clusters/${id}`, { method: 'DELETE' })
    loadClusters()
  }

  async function handleDeduct(e: React.FormEvent) {
    e.preventDefault()
    if (!deductCluster) return

    if (!deductProjectCode.trim()) {
      setDeductError('Project Code is required.')
      return
    }

    setDeducting(true); setDeductError(''); setDeductResult(null)

    let resolvedRequestId: number | null = null
    try {
      const lookup = await fetch(`/api/requests?projectCode=${encodeURIComponent(deductProjectCode.trim())}`)
      const lookupData = await lookup.json()
      const list = Array.isArray(lookupData) ? lookupData : (lookupData.requests ?? [])
      if (list.length > 0) {
        resolvedRequestId = list[0].id
      }
    } catch { /* silently ignore */ }

    try {
      const res = await fetch('/api/inventory/clusters/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusterId: deductCluster.id,
          units: parseFloat(deductUnits),
          notes: deductProjectCode.trim(),
          projectCode: deductProjectCode.trim(),
          requestId: resolvedRequestId ?? undefined,
        })
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.details) setDeductError(data.error + ':\n' + data.details.join('\n'))
        else throw new Error(data.error)
        return
      }
      setDeductResult(data)
      loadClusters()
      fetch('/api/inventory').then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : [])).catch(() => {})
    } catch (e: unknown) {
      setDeductError(e instanceof Error ? e.message : 'Deduction failed')
    } finally { setDeducting(false) }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: 14 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity={0.3}/>
          <path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/>
        </svg>
        Loading clusters…
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const totalDeductions = clusters.reduce((sum, c) => sum + (c._count?.deductions ?? 0), 0)

  return (
    <div style={{ padding: '24px 28px', maxWidth: '100%' }}>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard label="Total Clusters" value={clusters.length} sub="Consumption templates" accent="#10b981" />
        <KpiCard label="Total Deductions" value={totalDeductions} sub="Logged deductions" accent="#f59e0b" />
        <KpiCard
          label="Items Tracked"
          value={clusters.reduce((s, c) => s + c.items.length, 0)}
          sub="Across all clusters"
          accent="#3b82f6"
        />
        <KpiCard
          label="Low Stock Alerts"
          value={clusters.reduce((s, c) => s + c.items.filter(ci =>
            ci.qtyPerUnit > 0 && Math.floor(ci.item.quantity / ci.qtyPerUnit) < 10
          ).length, 0)}
          sub="Items running low"
          accent="#ef4444"
        />
      </div>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button
            onClick={() => router.push('/inventory')}
            style={{
              fontSize: 12, color: '#10b981', background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, fontWeight: 600, marginBottom: 4, display: 'block',
            }}
          >
            ← Back to Inventory
          </button>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Consumption Clusters</p>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>
            Define how much each chemical / consumable is used per sample or datapoint, then deduct in bulk.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => { setShowCreate(!showCreate); setEditClusterId(null) }}
            style={{
              padding: '8px 18px',
              background: showCreate ? 'rgba(241,245,249,0.9)' : '#10b981',
              color: showCreate ? '#374151' : '#fff',
              border: showCreate ? '1px solid rgba(209,213,219,0.8)' : 'none',
              borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            {showCreate ? 'Cancel' : '+ New Cluster'}
          </button>
        )}
      </div>

      {/* ── Create form ── */}
      {showCreate && canManage && (
        <div style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(191,219,254,0.8)',
          borderRadius: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 10px 40px rgba(15,23,42,0.06)',
          overflow: 'hidden', marginBottom: 20,
        }}>
          <div style={{
            padding: '14px 20px',
            background: 'rgba(239,246,255,0.7)',
            borderBottom: '1px solid rgba(191,219,254,0.6)',
          }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e40af' }}>Create New Consumption Cluster</p>
          </div>
          <div style={{ padding: 20 }}>
            <form onSubmit={handleCreate}>
              {createError && (
                <div style={{
                  background: '#fef2f2', border: '1px solid rgba(254,202,202,0.8)',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                  fontSize: 13, color: '#991b1b', whiteSpace: 'pre-line',
                }}>
                  {createError}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Cluster Name *</label>
                  <input
                    required value={clusterForm.name}
                    onChange={e => setClusterForm({ ...clusterForm, name: e.target.value })}
                    placeholder="e.g. DNA Extraction"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Unit Basis</label>
                  <select
                    value={clusterForm.unit}
                    onChange={e => setClusterForm({ ...clusterForm, unit: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="sample">Per Sample</option>
                    <option value="datapoint">Per Datapoint</option>
                    <option value="reaction">Per Reaction</option>
                    <option value="plate">Per Plate</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Linked Experiment</label>
                  <select
                    value={clusterForm.experimentId}
                    onChange={e => setClusterForm({ ...clusterForm, experimentId: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">None</option>
                    {experiments.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Description</label>
                  <input
                    value={clusterForm.description}
                    onChange={e => setClusterForm({ ...clusterForm, description: e.target.value })}
                    placeholder="Optional description…"
                    style={inputStyle}
                  />
                </div>
              </div>
              <ClusterRowEditor
                rows={clusterRows} items={items} unitLabel={clusterForm.unit}
                onAddRow={makeAddRow(clusterRows, setClusterRows)}
                onRemoveRow={makeRemoveRow(clusterRows, setClusterRows)}
                onUpdateRow={makeUpdateRow(clusterRows, setClusterRows)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{
                  padding: '7px 18px', fontSize: 13,
                  border: '1px solid rgba(209,213,219,0.8)', borderRadius: 10,
                  background: 'rgba(255,255,255,0.8)', color: '#374151',
                  cursor: 'pointer', fontWeight: 500,
                }}>
                  Cancel
                </button>
                <button type="submit" disabled={createSaving} style={{
                  padding: '7px 20px', fontSize: 13, background: '#10b981',
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontWeight: 600, cursor: createSaving ? 'not-allowed' : 'pointer',
                  opacity: createSaving ? 0.6 : 1,
                }}>
                  {createSaving ? 'Creating…' : 'Create Cluster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Clusters list ── */}
      {clusters.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(226,232,240,0.8)',
          borderRadius: 20,
          padding: 64, textAlign: 'center', color: '#94a3b8',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 10px 40px rgba(15,23,42,0.06)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚗</div>
          <p style={{ fontWeight: 700, color: '#374151', margin: 0 }}>No consumption clusters yet</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>
            Create a cluster to define how much each material is consumed per sample or datapoint.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {clusters.map((cluster, clusterIndex) => (
            <div key={cluster.id} style={{
              background: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(226,232,240,0.8)',
              borderRadius: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 10px 40px rgba(15,23,42,0.06)',
              overflow: 'hidden',
            }}>

              {/* Cluster header */}
              <div style={{
                padding: '16px 20px',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                background: 'rgba(248,250,252,0.7)',
                borderBottom: '1px solid rgba(241,245,249,0.9)',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                      {cluster.name}
                    </p>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      background: 'rgba(239,246,255,0.9)', color: '#1d4ed8',
                      padding: '2px 8px', borderRadius: 20, letterSpacing: '0.03em',
                    }}>
                      per {cluster.unit}
                    </span>
                    {cluster.experiment && (
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        background: 'rgba(245,243,255,0.9)', color: '#7e22ce',
                        padding: '2px 8px', borderRadius: 20,
                      }}>
                        {cluster.experiment.name}
                      </span>
                    )}
                  </div>
                  {cluster.description && (
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>{cluster.description}</p>
                  )}
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                    {cluster.items.length} item{cluster.items.length !== 1 ? 's' : ''} · {cluster._count?.deductions ?? 0} deduction{(cluster._count?.deductions ?? 0) !== 1 ? 's' : ''} logged
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      setDeductCluster(cluster)
                      setDeductUnits('')
                      setDeductProjectCode('')
                      setDeductResolvedRequestId(null)
                      setDeductResult(null)
                      setDeductError('')
                    }}
                    style={{
                      padding: '6px 14px', background: '#10b981', color: '#fff',
                      border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#059669')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#10b981')}
                  >
                    ↓ Deduct Usage
                  </button>
                  {canManage && (
                    <>
                      {/* ── Sort buttons ── */}
                      <button
                        onClick={() => handleReorder(cluster.id, 'up')}
                        disabled={clusterIndex === 0}
                        title="Move up"
                        style={{
                          padding: '6px 10px', fontSize: 14, fontWeight: 700,
                          border: '1px solid rgba(209,213,219,0.8)', borderRadius: 10,
                          background: 'rgba(255,255,255,0.8)', color: '#374151',
                          cursor: clusterIndex === 0 ? 'not-allowed' : 'pointer',
                          opacity: clusterIndex === 0 ? 0.35 : 1,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleReorder(cluster.id, 'down')}
                        disabled={clusterIndex === clusters.length - 1}
                        title="Move down"
                        style={{
                          padding: '6px 10px', fontSize: 14, fontWeight: 700,
                          border: '1px solid rgba(209,213,219,0.8)', borderRadius: 10,
                          background: 'rgba(255,255,255,0.8)', color: '#374151',
                          cursor: clusterIndex === clusters.length - 1 ? 'not-allowed' : 'pointer',
                          opacity: clusterIndex === clusters.length - 1 ? 0.35 : 1,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => editClusterId === cluster.id ? setEditClusterId(null) : startEdit(cluster)}
                        style={{
                          padding: '6px 14px', fontSize: 12, fontWeight: 600,
                          border: '1px solid rgba(209,213,219,0.8)', borderRadius: 10,
                          background: 'rgba(255,255,255,0.8)', color: '#374151', cursor: 'pointer',
                        }}
                      >
                        {editClusterId === cluster.id ? 'Cancel Edit' : 'Edit'}
                      </button>
                      <button
                        onClick={() => handleDelete(cluster.id, cluster.name)}
                        style={{
                          padding: '6px 14px', fontSize: 12, fontWeight: 600,
                          border: '1px solid rgba(254,202,202,0.8)', borderRadius: 10,
                          background: 'rgba(255,255,255,0.8)', color: '#dc2626', cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* ── Items table ── */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
                      {[
                        'Material', 'Type', 'Lab',
                        `Qty / ${cluster.unit}`, 'Unit',
                        'Current Stock', `Max ${cluster.unit}s`,
                      ].map((h, i) => (
                        <th key={i} style={{
                          padding: '10px 16px',
                          textAlign: (i === 3 || i === 5 || i === 6) ? 'right' : 'left',
                          fontSize: 11, fontWeight: 700,
                          color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em',
                          whiteSpace: 'nowrap',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cluster.items.map((ci, i) => {
                      const maxUnits = ci.qtyPerUnit > 0 ? Math.floor(ci.item.quantity / ci.qtyPerUnit) : null
                      const isLimiting = maxUnits !== null && maxUnits < 10
                      return (
                        <tr key={ci.id} style={{
                          borderBottom: i < cluster.items.length - 1 ? '1px solid rgba(241,245,249,0.9)' : 'none',
                          background: isLimiting
                            ? 'rgba(254,242,242,0.5)'
                            : i % 2 === 0 ? 'transparent' : 'rgba(248,250,252,0.4)',
                          transition: 'background 0.15s ease',
                        }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(236,253,245,0.7)')}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = isLimiting
                              ? 'rgba(254,242,242,0.5)'
                              : i % 2 === 0 ? 'transparent' : 'rgba(248,250,252,0.4)'
                          }}
                        >
                          <td style={{ padding: '11px 16px', fontWeight: 600, color: '#0f172a' }}>{ci.item.name}</td>
                          <td style={{ padding: '11px 16px' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600,
                              padding: '2px 8px', borderRadius: 20,
                              background: ci.item.type === 'CHEMICAL' ? 'rgba(245,243,255,0.9)' : 'rgba(240,253,250,0.9)',
                              color: ci.item.type === 'CHEMICAL' ? '#7e22ce' : '#0f766e',
                            }}>
                              {ci.item.type === 'CHEMICAL' ? 'Chemical' : 'Consumable'}
                            </span>
                          </td>
                          <td style={{ padding: '11px 16px', fontSize: 12, color: '#64748b' }}>{ci.item.lab.name}</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151' }}>
                            {ci.qtyPerUnit}
                          </td>
                          <td style={{ padding: '11px 16px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {ci.item.unit}
                          </td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{
                              fontWeight: ci.item.quantity < ci.qtyPerUnit * 5 ? 700 : 400,
                              color: ci.item.quantity < ci.qtyPerUnit * 5 ? '#f59e0b' : '#374151',
                            }}>
                              {ci.item.quantity}
                            </span>
                          </td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {maxUnits === null ? (
                              <span style={{ color: '#cbd5e1' }}>—</span>
                            ) : (
                              <span style={{ fontWeight: 700, color: isLimiting ? '#dc2626' : '#10b981' }}>
                                {maxUnits}{isLimiting && ' ⚠'}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Edit form (inline) */}
              {editClusterId === cluster.id && canManage && (
                <div style={{
                  borderTop: '1px solid rgba(191,219,254,0.6)',
                  background: 'rgba(239,246,255,0.4)',
                  padding: 20,
                }}>
                  <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>Edit Cluster</p>
                  <form onSubmit={handleEdit}>
                    {editError && (
                      <div style={{
                        background: '#fef2f2', border: '1px solid rgba(254,202,202,0.8)',
                        borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                        fontSize: 13, color: '#991b1b',
                      }}>
                        {editError}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
                      <div>
                        <label style={labelStyle}>Cluster Name *</label>
                        <input required value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Unit Basis</label>
                        <select value={editForm.unit}
                          onChange={e => setEditForm({ ...editForm, unit: e.target.value })}
                          style={inputStyle}>
                          <option value="sample">Per Sample</option>
                          <option value="datapoint">Per Datapoint</option>
                          <option value="reaction">Per Reaction</option>
                          <option value="plate">Per Plate</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Linked Experiment</label>
                        <select value={editForm.experimentId}
                          onChange={e => setEditForm({ ...editForm, experimentId: e.target.value })}
                          style={inputStyle}>
                          <option value="">None</option>
                          {experiments.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                        </select>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Description</label>
                        <input value={editForm.description}
                          onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                          style={inputStyle} />
                      </div>
                    </div>
                    <ClusterRowEditor
                      rows={editRows} items={items} unitLabel={editForm.unit}
                      onAddRow={makeAddRow(editRows, setEditRows)}
                      onRemoveRow={makeRemoveRow(editRows, setEditRows)}
                      onUpdateRow={makeUpdateRow(editRows, setEditRows)}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                      <button type="button" onClick={() => setEditClusterId(null)} style={{
                        padding: '7px 18px', fontSize: 13,
                        border: '1px solid rgba(209,213,219,0.8)', borderRadius: 10,
                        background: 'rgba(255,255,255,0.8)', color: '#374151', cursor: 'pointer',
                      }}>
                        Cancel
                      </button>
                      <button type="submit" disabled={editSaving} style={{
                        padding: '7px 20px', fontSize: 13, background: '#3b82f6',
                        color: '#fff', border: 'none', borderRadius: 10,
                        fontWeight: 600, cursor: editSaving ? 'not-allowed' : 'pointer',
                        opacity: editSaving ? 0.6 : 1,
                      }}>
                        {editSaving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Deduct Modal ── */}
      {deductCluster && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '72px 16px 24px',
          background: 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 20,
            boxShadow: '0 25px 80px rgba(15,23,42,0.25)',
            width: '100%', maxWidth: 760,
            margin: '0 16px',
            maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            border: '1px solid rgba(226,232,240,0.8)',
            overflow: 'hidden',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid rgba(241,245,249,0.9)',
              background: 'rgba(248,250,252,0.8)',
              flexShrink: 0,
            }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Deduct Usage</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                Cluster: <strong style={{ color: '#374151' }}>{deductCluster.name}</strong>
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {!deductResult ? (
                <form onSubmit={handleDeduct} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  {deductError && (
                    <div style={{
                      margin: '12px 20px 0',
                      background: '#fef2f2', border: '1px solid rgba(254,202,202,0.8)',
                      borderRadius: 10, padding: '8px 12px',
                      fontSize: 13, color: '#991b1b', whiteSpace: 'pre-line',
                      flexShrink: 0,
                    }}>
                      {deductError}
                    </div>
                  )}

                  {/* Scrollable preview table */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 0' }}>
                    <p style={{ ...labelStyle, marginBottom: 6 }}>
                      What will be deducted per {deductCluster.unit}:
                    </p>
                    <div style={{ border: '1px solid rgba(226,232,240,0.8)', borderRadius: 10, overflow: 'hidden' }}>
                      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
                            {['Material', `Per ${deductCluster.unit}`, `Total (${deductUnits || '?'} ×)`, 'In Stock'].map((h, i) => (
                              <th key={h} style={{
                                padding: '8px 12px',
                                textAlign: (i === 1 || i === 2 || i === 3) ? 'right' : 'left',
                                fontSize: 11, fontWeight: 700,
                                color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em',
                                whiteSpace: 'nowrap', background: '#f8fafc',
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {deductCluster.items.map((ci, i) => {
                            const total = deductUnits ? parseFloat(deductUnits) * ci.qtyPerUnit : null
                            const insufficient = total !== null && total > ci.item.quantity
                            return (
                              <tr key={ci.id} style={{
                                borderBottom: i < deductCluster.items.length - 1 ? '1px solid rgba(241,245,249,0.9)' : 'none',
                                background: insufficient ? 'rgba(254,242,242,0.5)' : i % 2 === 0 ? 'transparent' : 'rgba(248,250,252,0.4)',
                              }}>
                                <td style={{ padding: '7px 12px', color: '#374151', fontWeight: 500 }}>{ci.item.name}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                                  {ci.qtyPerUnit}
                                </td>
                                <td style={{
                                  padding: '7px 12px', textAlign: 'right',
                                  fontVariantNumeric: 'tabular-nums',
                                  color: insufficient ? '#dc2626' : '#374151', whiteSpace: 'nowrap',
                                }}>
                                  {total !== null ? <span style={{ fontWeight: 600 }}>{total.toFixed(4)}</span> : '—'}
                                </td>
                                <td style={{
                                  padding: '7px 12px', textAlign: 'right', fontSize: 12,
                                  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                                  color: insufficient ? '#dc2626' : '#64748b',
                                }}>
                                  <span style={{ fontWeight: 600 }}>{ci.item.quantity}</span>
                                  <span style={{ color: '#94a3b8', margin: '0 3px' }}>×</span>
                                  <span style={{ color: insufficient ? '#dc2626' : '#94a3b8' }}>{ci.item.unit}</span>
                                  {insufficient && <span style={{ marginLeft: 3, color: '#dc2626' }}>⚠</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Fixed footer — inputs + buttons */}
                  <div style={{
                    padding: '12px 20px',
                    borderTop: '1px solid rgba(241,245,249,0.9)',
                    background: 'rgba(248,250,252,0.6)',
                    flexShrink: 0,
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={labelStyle}>
                          Number of {deductCluster.unit}s processed *
                        </label>
                        <input
                          required type="number" step="0.1" min="0.1"
                          value={deductUnits}
                          onChange={e => setDeductUnits(e.target.value)}
                          placeholder="e.g. 96"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>
                          Project Code *
                          <span style={{
                            marginLeft: 6, fontSize: 10, fontWeight: 600,
                            color: '#dc2626', letterSpacing: '0.04em',
                          }}>
                            REQUIRED
                          </span>
                        </label>
                        <input
                          required
                          value={deductProjectCode}
                          onChange={e => setDeductProjectCode(e.target.value)}
                          placeholder="e.g. ICTP002"
                          style={{
                            ...inputStyle,
                            borderColor: deductProjectCode.trim() === '' && deductError
                              ? '#dc2626'
                              : 'rgba(209,213,219,0.8)',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button type="button" onClick={() => setDeductCluster(null)} style={{
                        padding: '7px 18px', fontSize: 13,
                        border: '1px solid rgba(209,213,219,0.8)', borderRadius: 10,
                        background: 'rgba(255,255,255,0.8)', color: '#374151', cursor: 'pointer',
                      }}>
                        Cancel
                      </button>
                      <button type="submit" disabled={deducting} style={{
                        padding: '7px 20px', fontSize: 13, background: '#10b981',
                        color: '#fff', border: 'none', borderRadius: 10,
                        fontWeight: 600, cursor: deducting ? 'not-allowed' : 'pointer',
                        opacity: deducting ? 0.6 : 1,
                      }}>
                        {deducting ? 'Deducting…' : 'Confirm Deduction'}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                    <div style={{
                      background: 'rgba(240,253,244,0.8)',
                      border: '1px solid rgba(167,243,208,0.8)',
                      borderRadius: 10, padding: '12px 14px', marginBottom: 12,
                    }}>
                      <p style={{ fontWeight: 700, color: '#15803d', margin: 0 }}>✓ Deduction successful</p>
                      <p style={{ fontSize: 13, color: '#166534', margin: '2px 0 0' }}>
                        {deductResult.units} {deductCluster.unit}(s) of &ldquo;{deductResult.cluster}&rdquo; processed.
                      </p>
                      <p style={{ fontSize: 12, color: '#166534', margin: '2px 0 0' }}>
                        Project Code: <strong>{deductProjectCode}</strong>
                      </p>
                    </div>
                    <div style={{ border: '1px solid rgba(226,232,240,0.8)', borderRadius: 10, overflow: 'hidden' }}>
                      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
                            {['Material', 'Deducted', 'Remaining'].map((h, i) => (
                              <th key={h} style={{
                                padding: '8px 12px', textAlign: i === 0 ? 'left' : 'right',
                                fontSize: 11, fontWeight: 700, color: '#64748b',
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {deductResult.deducted.map((d, i) => (
                            <tr key={i} style={{ borderBottom: i < deductResult.deducted.length - 1 ? '1px solid rgba(241,245,249,0.9)' : 'none' }}>
                              <td style={{ padding: '7px 12px', color: '#374151', fontWeight: 500 }}>{d.name}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                −{d.deducted} {d.unit}
                              </td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151', whiteSpace: 'nowrap' }}>
                                {d.remaining} {d.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div style={{
                    padding: '12px 20px',
                    borderTop: '1px solid rgba(241,245,249,0.9)',
                    background: 'rgba(248,250,252,0.6)',
                    display: 'flex', justifyContent: 'flex-end', flexShrink: 0,
                  }}>
                    <button onClick={() => setDeductCluster(null)} style={{
                      padding: '8px 24px', fontSize: 13, background: '#0f172a',
                      color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer',
                    }}>
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}