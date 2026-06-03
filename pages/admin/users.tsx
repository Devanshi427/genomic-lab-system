// pages/admin/users.tsx
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

type User = {
  id: number
  name: string
  email: string
  role: string
}

const ROLES = ['BREEDER', 'BIOTECHNOLOGIST', 'INVENTORY_MANAGER', 'MANAGEMENT', 'ADMIN']

const ROLE_STYLES: Record<string, { bg: string; color: string; dot: string }> = {
  ADMIN:             { bg: '#fef2f2', color: '#991b1b', dot: '#f87171' },
  MANAGEMENT:        { bg: '#faf5ff', color: '#7e22ce', dot: '#c084fc' },
  BIOTECHNOLOGIST:   { bg: '#eff6ff', color: '#1d4ed8', dot: '#60a5fa' },
  INVENTORY_MANAGER: { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  BREEDER:           { bg: '#fefce8', color: '#854d0e', dot: '#fbbf24' },
}

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
  padding: '8px 12px',
  fontSize: 13,
  color: '#374151',
  outline: 'none',
  background: 'rgba(255,255,255,0.9)',
  boxSizing: 'border-box',
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent: string }) {
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
      <p style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{sub}</p>}
    </div>
  )
}

// ── Role Badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLES[role] ?? { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color, letterSpacing: '0.03em',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {role}
    </span>
  )
}

// ── Shared table components ───────────────────────────────────────────────────
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

const TD = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td style={{
    padding: '12px 16px',
    whiteSpace: 'nowrap',
    fontSize: 13,
    color: '#374151',
    textAlign: right ? 'right' : 'left',
  }}>
    {children}
  </td>
)

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [users, setUsers]       = useState<User[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({ name: '', email: '', password: '', userRole: 'BREEDER' })
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  const role = (session?.user as Record<string, unknown>)?.role as string

  useEffect(() => {
    if (status === 'loading') return
    if (!session || role !== 'ADMIN') router.push('/login')
  }, [session, status, role, router])

  function load() {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => { setUsers(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { if (session) load() }, [session])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowForm(false)
      setForm({ name: '', email: '', password: '', userRole: 'BREEDER' })
      load()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  async function handleRoleChange(userId: number, newRole: string) {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userRole: newRole }),
    })
    load()
  }

  async function handleDelete(userId: number, name: string) {
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    load()
  }

  // ── Role counts for KPIs ──────────────────────────────────────────────────
  const adminCount  = users.filter(u => u.role === 'ADMIN').length
  const breederCount = users.filter(u => u.role === 'BREEDER').length

  if (loading) {
    return (
      <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: 14 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity={0.3} />
          <path d="M21 12a9 9 0 00-9-9" strokeLinecap="round" />
        </svg>
        Loading users…
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: '100%' }}>

      {/* ── KPI Strip ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard label="Total Users"  value={users.length} sub="All registered accounts" accent="#10b981" />
        <KpiCard label="Admins"       value={adminCount}   sub="Full system access"      accent="#ef4444" />
        <KpiCard label="Breeders"     value={breederCount} sub="Request submitters"      accent="#f59e0b" />
        <KpiCard
          label="Other Roles"
          value={users.length - adminCount - breederCount}
          sub="Lab & management staff"
          accent="#8b5cf6"
        />
      </div>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: 20,
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>User Management</p>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>
            {users.length} registered account{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '8px 18px',
            background: showForm ? 'rgba(241,245,249,0.9)' : '#10b981',
            color: showForm ? '#374151' : '#fff',
            border: showForm ? '1px solid rgba(209,213,219,0.8)' : 'none',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            if (!showForm) (e.currentTarget as HTMLButtonElement).style.background = '#059669'
          }}
          onMouseLeave={e => {
            if (!showForm) (e.currentTarget as HTMLButtonElement).style.background = '#10b981'
          }}
        >
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {/* ── Create User Form ─────────────────────────────────────────────── */}
      {showForm && (
        <div style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(191,219,254,0.8)',
          borderRadius: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 10px 40px rgba(15,23,42,0.06)',
          overflow: 'hidden',
          marginBottom: 20,
        }}>
          <div style={{
            padding: '14px 20px',
            background: 'rgba(239,246,255,0.7)',
            borderBottom: '1px solid rgba(191,219,254,0.6)',
          }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e40af' }}>Add New User</p>
          </div>
          <div style={{ padding: 20 }}>
            {formError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid rgba(254,202,202,0.8)',
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 13,
                color: '#991b1b',
              }}>
                {formError}
              </div>
            )}
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input
                    type="text" required value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Priya Sharma"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email" required value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="user@example.com"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input
                    type="password" required value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 8 characters"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Role</label>
                  <select
                    value={form.userRole}
                    onChange={e => setForm(f => ({ ...f, userRole: e.target.value }))}
                    style={inputStyle}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{
                  padding: '7px 18px', fontSize: 13,
                  border: '1px solid rgba(209,213,219,0.8)', borderRadius: 10,
                  background: 'rgba(255,255,255,0.8)', color: '#374151',
                  cursor: 'pointer', fontWeight: 500,
                }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{
                  padding: '7px 20px', fontSize: 13,
                  background: saving ? 'rgba(16,185,129,0.5)' : '#10b981',
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {saving && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity={0.3} />
                      <path d="M21 12a9 9 0 00-9-9" strokeLinecap="round" />
                    </svg>
                  )}
                  {saving ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Users Table ──────────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(226,232,240,0.8)',
        borderRadius: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 10px 40px rgba(15,23,42,0.06)',
        overflow: 'hidden',
      }}>

        {/* Table header bar */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(241,245,249,0.9)',
          background: 'rgba(248,250,252,0.7)',
        }}>
          <p style={{
            margin: 0, fontSize: 11, fontWeight: 700, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            All Users
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Current Role</TH>
                <TH>Change Role</TH>
                <TH>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr
                  key={u.id}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Avatar initials */}
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: ROLE_STYLES[u.role]?.bg ?? '#f1f5f9',
                        border: `1px solid ${ROLE_STYLES[u.role]?.dot ?? '#94a3b8'}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700,
                        color: ROLE_STYLES[u.role]?.color ?? '#475569',
                        flexShrink: 0,
                      }}>
                        {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{u.name}</span>
                    </div>
                  </TD>
                  <TD>
                    <span style={{ color: '#64748b' }}>{u.email}</span>
                  </TD>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <RoleBadge role={u.role} />
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      style={{
                        border: '1px solid rgba(209,213,219,0.8)',
                        borderRadius: 7,
                        padding: '5px 9px',
                        fontSize: 12,
                        color: '#374151',
                        background: 'rgba(255,255,255,0.9)',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => handleDelete(u.id, u.name)}
                        style={{
                          fontSize: 12, fontWeight: 600,
                          padding: '4px 12px',
                          border: '1px solid rgba(254,202,202,0.8)',
                          borderRadius: 8,
                          color: '#dc2626',
                          background: 'rgba(255,255,255,0.8)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(254,242,242,0.9)'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.8)'
                        }}
                      >
                        Delete
                      </button>
                      <a
                        href={`/admin/user-activity/${u.id}`}
                        style={{
                          fontSize: 12, fontWeight: 600,
                          padding: '4px 12px',
                          border: '1px solid rgba(191,219,254,0.8)',
                          borderRadius: 8,
                          color: '#1d4ed8',
                          background: 'rgba(255,255,255,0.8)',
                          textDecoration: 'none',
                          transition: 'all 0.15s ease',
                          display: 'inline-block',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(239,246,255,0.9)'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.8)'
                        }}
                      >
                        Activity
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(241,245,249,0.9)',
          background: 'rgba(248,250,252,0.5)',
        }}>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
            {users.length} user{users.length !== 1 ? 's' : ''} registered
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}