// pages/admin/user-activity/[userId].tsx
// FIX: removed manual <Layout> import and wrapper — pages/_app.tsx already
// wraps every page in <Layout>, so this page was rendering a double navbar,
// double ToastNotification, and double ambient background blobs.
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

type AuditEntry = {
  id: number; action: string; entity: string; entityId: string | null
  detail: string | null; createdAt: string
}
type UserInfo = { id: number; name: string; email: string; role: string }

const PAGE_SIZE = 25

export default function UserActivityPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const userId = router.query.userId as string

  const [user,    setUser]    = useState<UserInfo | null>(null)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
      return
    }
    const role = (session?.user as Record<string, unknown>)?.role
    if (status === 'authenticated' && role !== 'ADMIN') {
      router.push('/')
    }
  }, [session, status, router])

  useEffect(() => {
    if (!userId) return

    const controller = new AbortController()

    async function fetchActivity() {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/admin/user-activity?userId=${userId}&page=${page}&limit=${PAGE_SIZE}`,
          { signal: controller.signal }
        )
        const json = await res.json()
        setUser(json.user)
        setEntries(json.entries)
        setTotal(json.total)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchActivity()
    return () => controller.abort()
  }, [userId, page])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline mb-4 block">
        ← Back to Users
      </button>

      {user && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                       rounded-lg p-5 mb-6">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">{user.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email} · {user.role}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {total} total audit entries
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading activity...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400">No audit entries found for this user.</p>
      ) : (
        <>
          <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Timestamp</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Entity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {entries.map(e => (
                  <tr key={e.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                      {formatDate(e.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-700
                                      dark:text-blue-300 px-2 py-0.5 rounded text-xs font-medium">
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">
                      {e.entity}{e.entityId ? ` #${e.entityId}` : ''}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs max-w-xs truncate">
                      {e.detail ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">
              {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={page * PAGE_SIZE >= total}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}