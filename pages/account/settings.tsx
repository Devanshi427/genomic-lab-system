// pages/account/settings.tsx
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

const FIELDS = [
  { key: 'currentPassword', label: 'Current Password', hint: 'Enter your existing password to confirm your identity' },
  { key: 'newPassword',     label: 'New Password',     hint: 'Minimum 8 characters recommended' },
  { key: 'confirmPassword', label: 'Confirm New Password', hint: 'Must match the new password above' },
] as const

const ROLE_COLOURS: Record<string, { bg: string; color: string }> = {
  ADMIN:             { bg: 'rgba(139,92,246,0.10)',  color: '#7e22ce' },
  BIOTECHNOLOGIST:   { bg: 'rgba(16,185,129,0.10)',  color: '#065f46' },
  BREEDER:           { bg: 'rgba(59,130,246,0.10)',  color: '#1d4ed8' },
  INVENTORY_MANAGER: { bg: 'rgba(245,158,11,0.10)',  color: '#92400e' },
  MANAGEMENT:        { bg: 'rgba(239,68,68,0.10)',   color: '#991b1b' },
}

export default function AccountSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [form, setForm]     = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError]   = useState('')

  const role      = (session?.user as Record<string, unknown>)?.role as string
  const roleStyle = ROLE_COLOURS[role] ?? { bg: 'rgba(148,163,184,0.12)', color: '#64748b' }

  if (status === 'loading') return (
    <div style={{ padding: 32, color: '#94a3b8', fontSize: 14 }}>Loading…</div>
  )
  if (!session) { router.push('/login'); return null }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
    if (form.newPassword !== form.confirmPassword) return setError('New passwords do not match.')
    setSaving(true)
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess('Password changed successfully.')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
            Account Settings
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
              Logged in as <span style={{ fontWeight: 600, color: '#374151' }}>{session.user?.name}</span>
            </p>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
              textTransform: 'uppercase', letterSpacing: '0.05em',
              background: roleStyle.bg, color: roleStyle.color,
            }}>
              {role}
            </span>
          </div>
        </div>

        {/* ── Profile card ── */}
        <div style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(226,232,240,0.8)', borderRadius: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 10px 40px rgba(15,23,42,0.06)',
          marginBottom: 20, overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid rgba(241,245,249,0.9)',
            background: 'rgba(248,250,252,0.7)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(6,182,212,0.08))',
              borderRadius: 9, color: '#059669', flexShrink: 0,
            }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </span>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>Profile</h2>
          </div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
            {[
              ['Name', session.user?.name ?? '—'],
              ['Email', session.user?.email ?? '—'],
              ['Role', role],
            ].map(([label, value]) => (
              <div key={label}>
                <dt style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</dt>
                <dd style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: 0 }}>{value}</dd>
              </div>
            ))}
          </div>
        </div>

        {/* ── Change password card ── */}
        <div style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(226,232,240,0.8)', borderRadius: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 10px 40px rgba(15,23,42,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid rgba(241,245,249,0.9)',
            background: 'rgba(248,250,252,0.7)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(6,182,212,0.08))',
              borderRadius: 9, color: '#059669', flexShrink: 0,
            }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </span>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>Change Password</h2>
          </div>

          <div style={{ padding: 20 }}>
            {/* Error banner */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)',
                borderRadius: 12, padding: '11px 16px', fontSize: 13, color: '#991b1b', marginBottom: 16,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* Success banner */}
            {success && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 12, padding: '11px 16px', fontSize: 13, color: '#065f46', marginBottom: 16,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {FIELDS.map(({ key, label, hint }) => (
                <div key={key}>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
                  }}>
                    {label}
                  </label>
                  <input
                    type="password"
                    required
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      border: '1px solid rgba(209,213,219,0.8)', borderRadius: 10,
                      padding: '9px 13px', fontSize: 13, color: '#374151',
                      background: 'rgba(255,255,255,0.7)', outline: 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = '#34d399'
                      e.currentTarget.style.boxShadow = '0 0 0 4px rgba(52,211,153,0.15)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'rgba(209,213,219,0.8)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                  {hint && <p style={{ fontSize: 11, color: '#94a3b8', margin: '5px 0 0' }}>{hint}</p>}
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid rgba(241,245,249,0.9)' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 24px', fontSize: 13, fontWeight: 700,
                    border: 'none', borderRadius: 12, cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1, color: '#fff',
                    background: 'linear-gradient(135deg,#059669 0%,#10b981 50%,#06b6d4 100%)',
                    boxShadow: saving ? 'none' : '0 4px 14px rgba(16,185,129,0.3)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)' }}
                >
                  {saving ? 'Saving…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}