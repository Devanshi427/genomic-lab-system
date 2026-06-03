// pages/inventory/new.tsx
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

const TYPE_OPTIONS = ['CHEMICAL', 'CONSUMABLE']
const UNIT_OPTIONS = ['mg', 'g', 'kg', 'mL', 'µL', 'L', 'packets', 'vials', 'tubes', 'boxes', 'units']

type Lab = { id: number; name: string }

type FormState = {
  name:              string
  catalogueNumber:   string
  brand:             string
  category:          string
  type:              string
  labId:             string
  quantity:          string
  unit:              string
  minThreshold:      string
  manufacturingDate: string
  expiryDate:        string
  notes:             string
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconFlask = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a2.25 2.25 0 01.45 1.317c0 1.16-.905 2.154-2.058 2.2a48.424 48.424 0 01-14.385 0C2.575 18.47 1.67 17.477 1.67 16.317A2.25 2.25 0 012.12 15M19.8 15H4.2" />
  </svg>
)

const IconCube = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
  </svg>
)

const IconCalendar = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
)

const IconNote = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
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

// ── Field wrapper ─────────────────────────────────────────────────────────────
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NewInventoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = (session?.user as Record<string, unknown>)?.role as string

  const [form, setForm] = useState<FormState>({
    name: '', catalogueNumber: '', brand: '', category: '',
    type: 'CHEMICAL', labId: '', quantity: '', unit: '',
    minThreshold: '0', manufacturingDate: '', expiryDate: '', notes: '',
  })
  const [labs, setLabs]             = useState<Lab[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    if (!session) return
    fetch('/api/labs')
      .then(r => r.json())
      .then((data: Lab[]) => setLabs(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [session])

  if (status === 'loading') return (
    <div style={{ padding: 32, color: '#94a3b8', fontSize: 14 }}>Loading...</div>
  )
  if (!session) { router.push('/login'); return null }
  if (role !== 'ADMIN' && role !== 'INVENTORY_MANAGER') {
    return <div style={{ padding: 32, color: '#dc2626' }}>Access denied.</div>
  }

  const today     = new Date().toISOString().split('T')[0]
  const isExpired = form.expiryDate && form.expiryDate < today

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim())     return setError('Material name is required')
    if (!form.labId)           return setError('Lab is required')
    if (!form.quantity.trim()) return setError('Available Quantity is required')
    if (!form.unit.trim())     return setError('Unit of Qty is required')
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:              form.name,
          catalogueNumber:   form.catalogueNumber   || null,
          brand:             form.brand             || null,
          category:          form.category          || 'General',
          type:              form.type              || 'CHEMICAL',
          labId:             parseInt(form.labId),
          quantity:          parseFloat(form.quantity),
          unit:              form.unit,
          minThreshold:      parseFloat(form.minThreshold) || 0,
          manufacturingDate: form.manufacturingDate || null,
          expiryDate:        form.expiryDate        || null,
          notes:             form.notes             || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      router.push('/inventory')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Page content — bottom padding clears sticky footer */}
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
            Add Inventory Item
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 6, marginBottom: 0 }}>
            Register a new chemical or consumable item to the lab inventory.
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

            {/* ── Section 1: Item Details ── */}
            <SectionCard icon={<IconFlask />} title="Item Details">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Material — full width */}
                <Field label="Material" required>
                  <input type="text" name="name" value={form.name}
                    onChange={handleChange} required
                    placeholder="e.g. Taq DNA Polymerase"
                    className={`${IC} field-input`} />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>

                  <Field label="Catalogue Number">
                    <input type="text" name="catalogueNumber" value={form.catalogueNumber}
                      onChange={handleChange} placeholder="e.g. CAT-00123"
                      className={`${IC} field-input`} />
                  </Field>

                  <Field label="Brand of Supply">
                    <input type="text" name="brand" value={form.brand}
                      onChange={handleChange} placeholder="e.g. Sigma, Thermo Fisher"
                      className={`${IC} field-input`} />
                  </Field>

                  <Field label="Category">
                    <input type="text" name="category" value={form.category}
                      onChange={handleChange} placeholder="e.g. Buffer, Enzyme, Plasticware"
                      className={`${IC} field-input`} />
                  </Field>

                  <Field label="Type">
                    <select name="type" value={form.type}
                      onChange={handleChange} className={`${IC} field-input`}>
                      {TYPE_OPTIONS.map(t => (
                        <option key={t} value={t}>
                          {t === 'CHEMICAL' ? '🧪 Chemical' : '🧴 Consumable'}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {/* Lab — full width */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <Field label="Lab" required>
                      <select name="labId" value={form.labId}
                        onChange={handleChange} required className={`${IC} field-input`}>
                        <option value="">Select lab…</option>
                        {labs.map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                </div>
              </div>
            </SectionCard>

            {/* ── Section 2: Quantity ── */}
            <SectionCard icon={<IconCube />} title="Quantity">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>

                <Field label="Available Qty" required>
                  <input type="number" name="quantity" value={form.quantity}
                    onChange={handleChange} min={0} step="0.01" required
                    className={`${IC} field-input`} />
                </Field>

                <Field label="Unit of Qty" required>
                  <select name="unit" value={form.unit}
                    onChange={handleChange} required className={`${IC} field-input`}>
                    <option value="">Select unit…</option>
                    {UNIT_OPTIONS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </Field>

                <div style={{ gridColumn: 'span 2' }}>
                  <Field
                    label="Min Threshold"
                    hint="Triggers a Low Stock alert when quantity falls below this value."
                  >
                    <input type="number" name="minThreshold" value={form.minThreshold}
                      onChange={handleChange} min={0} step="0.01"
                      className={`${IC} field-input`} />
                  </Field>
                </div>

              </div>
            </SectionCard>

            {/* ── Section 3: Dates ── */}
            <SectionCard icon={<IconCalendar />} title="Dates">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>

                <Field label="Mfg Date">
                  <input type="date" name="manufacturingDate" value={form.manufacturingDate}
                    onChange={handleChange} className={`${IC} field-input`} />
                </Field>

                <Field label="Expiry Date">
                  <input type="date" name="expiryDate" value={form.expiryDate}
                    onChange={handleChange} className={`${IC} field-input`} />
                </Field>

              </div>

              {isExpired && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginTop: 14,
                  background: 'rgba(254,242,242,0.9)',
                  border: '1px solid rgba(252,165,165,0.5)',
                  borderRadius: 12, padding: '10px 14px',
                  color: '#b91c1c', fontSize: 13, fontWeight: 500,
                }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Expiry date is in the past — this item will be flagged as <strong style={{ marginLeft: 3 }}>Expiring</strong>.
                </div>
              )}
            </SectionCard>

            {/* ── Section 4: Notes ── */}
            <SectionCard icon={<IconNote />} title="Notes">
              <textarea
                name="notes" value={form.notes} onChange={handleChange}
                rows={3}
                placeholder="Any additional notes about this item…"
                className={`${IC} field-input`}
                style={{ resize: 'vertical' }}
              />
            </SectionCard>

          </div>
        </form>
      </div>

      {/* ── Sticky action footer ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
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
          onClick={() => router.push('/inventory')}
          style={{
            padding: '9px 20px', fontSize: 13, fontWeight: 600,
            border: '1px solid rgba(209,213,219,0.8)',
            borderRadius: 12, cursor: 'pointer',
            background: 'rgba(255,255,255,0.8)', color: '#374151',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.8)')}
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
            transition: 'all 0.15s ease',
            opacity: submitting ? 0.75 : 1,
          }}
          onMouseEnter={e => { if (!submitting) e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          {submitting && <IconSpinner />}
          {submitting ? 'Saving…' : 'Add Item'}
        </button>
      </div>
    </>
  )
}