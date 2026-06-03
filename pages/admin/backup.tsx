// pages/admin/backup.tsx

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'

type BackupEntry = { filename: string; sizeKb: number; createdAt: string }

export default function BackupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [backups, setBackups]     = useState<BackupEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [message, setMessage]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/admin/backup')
    if (r.ok) setBackups(await r.json())
    setLoading(false)
  }, [])

  const didLoad = useRef(false)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/'); return }
    const role = (session?.user as Record<string, unknown>)?.role
    if (status === 'authenticated' && role !== 'ADMIN') { router.push('/'); return }
    if (status === 'authenticated' && !didLoad.current) {
      didLoad.current = true
      void (async () => { await load() })()
    }
  }, [session, status, router, load])

  async function handleCreate() {
    setCreating(true); setMessage(null)
    const r = await fetch('/api/admin/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create' }),
    })
    if (r.ok) {
      setMessage({ type: 'ok', text: 'Backup created successfully.' })
      await load()
    } else {
      const e = await r.json()
      setMessage({ type: 'err', text: `Failed: ${e.error}` })
    }
    setCreating(false)
  }

  async function handleRestore(filename: string) {
    if (!confirm(`Restore from ${filename}? This will overwrite ALL current data. This cannot be undone.`)) return
    setRestoring(filename); setMessage(null)
    const r = await fetch('/api/admin/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore', filename }),
    })
    if (r.ok) {
      setMessage({ type: 'ok', text: 'Restore completed. Please refresh the application.' })
    } else {
      const e = await r.json()
      setMessage({ type: 'err', text: `Restore failed: ${e.error}` })
    }
    setRestoring(null)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const cardStyle = {
    background: 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(226,232,240,0.8)',
    borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 10px 40px rgba(15,23,42,0.06)',
  }

  return (
    <div style={{ padding: '32px', minHeight: '100vh', background: '#f8fafc', fontFamily: 'inherit' }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Database Backups
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Daily backups run automatically at 02:00 AM. Up to 14 backups are kept.
          </p>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            background: creating ? '#93c5fd' : '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: creating ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 3px rgba(59,130,246,0.25)',
            transition: 'background 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {creating ? 'Creating…' : '+ Create Backup Now'}
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 18px',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: 500,
          ...(message.type === 'ok'
            ? { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#065f46' }
            : { background: 'rgba(239,68,68,0.08)',  border: '1px solid rgba(239,68,68,0.20)',  color: '#991b1b' }),
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
            background: message.type === 'ok' ? '#10b981' : '#ef4444',
          }} />
          {message.text}
        </div>
      )}

      {/* Table / states */}
      {loading ? (
        <div style={{ ...cardStyle, padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          Loading backups…
        </div>
      ) : backups.length === 0 ? (
        <div style={{ ...cardStyle, padding: '48px', textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
            No backups found. Click &ldquo;Create Backup Now&rdquo; to create the first one.
          </p>
        </div>
      ) : (
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
                {['Filename', 'Created', 'Size', 'Actions'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: '12px 20px',
                      textAlign: i >= 2 ? 'right' : 'left',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {backups.map((b, i) => (
                <tr
                  key={b.filename}
                  style={{
                    borderBottom: '1px solid rgba(226,232,240,0.5)',
                    background: i === 0
                      ? 'rgba(59,130,246,0.04)'
                      : i % 2 === 1
                      ? 'rgba(248,250,252,0.4)'
                      : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(236,253,245,0.7)')}
                  onMouseLeave={e => (e.currentTarget.style.background =
                    i === 0 ? 'rgba(59,130,246,0.04)' : i % 2 === 1 ? 'rgba(248,250,252,0.4)' : 'transparent')}
                >
                  {/* Filename */}
                  <td style={{ padding: '13px 20px', maxWidth: '320px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.filename}
                      </span>
                      {i === 0 && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          background: 'rgba(59,130,246,0.10)', color: '#3b82f6',
                          fontSize: '11px', fontWeight: 600,
                          padding: '2px 9px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0,
                        }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#3b82f6' }} />
                          Latest
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Created */}
                  <td style={{ padding: '13px 20px', color: '#64748b' }}>
                    {formatDate(b.createdAt)}
                  </td>

                  {/* Size */}
                  <td style={{ padding: '13px 20px', textAlign: 'right', color: '#64748b' }}>
                    {b.sizeKb.toLocaleString()} KB
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleRestore(b.filename)}
                      disabled={restoring === b.filename}
                      style={{
                        background: restoring === b.filename ? 'rgba(239,68,68,0.06)' : 'transparent',
                        border: '1px solid rgba(239,68,68,0.25)',
                        borderRadius: '7px',
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: restoring === b.filename ? '#fca5a5' : '#ef4444',
                        cursor: restoring === b.filename ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (restoring !== b.filename) {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (restoring !== b.filename) {
                          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                        }
                      }}
                    >
                      {restoring === b.filename ? 'Restoring…' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}