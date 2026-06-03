// components/ToastNotification.tsx
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { io } from 'socket.io-client'

type Toast = { id: number; message: string; type: 'info' | 'warning' | 'success' }

let toastSocket: ReturnType<typeof io> | null = null

export default function ToastNotification() {
  const { data: session } = useSession()
  const [toasts, setToasts] = useState<Toast[]>([])
  const role   = (session?.user as Record<string, unknown>)?.role as string
  const userId = (session?.user as Record<string, unknown>)?.id as string

  useEffect(() => {
    if (!role) return

    fetch('/api/socket').finally(() => {
      if (!toastSocket) {
        toastSocket = io({ path: '/api/socket', addTrailingSlash: false })
      }

      // Join role room
      toastSocket.emit('join-role', role)

      // Join personal user room for targeted notifications
      if (userId) {
        toastSocket.emit('join-user', userId)
      }

      toastSocket.on('notification', (data: { message: string; type: Toast['type'] }) => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, ...data }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
      })
    })

    return () => { toastSocket?.off('notification') }
  }, [role, userId])

  if (toasts.length === 0) return null

  return (
    <div className='fixed top-4 right-4 z-50 space-y-2 max-w-sm'>
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`rounded-lg border px-4 py-3 shadow-lg text-sm flex items-start gap-3 ${
            toast.type === 'success' ? 'bg-green-50 border-green-300 text-green-800'
            : toast.type === 'warning' ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
            : 'bg-blue-50 border-blue-300 text-blue-800'
          }`}
        >
          <span className='flex-1'>{toast.message}</span>
          <button
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            className='shrink-0 text-current opacity-50 hover:opacity-100'
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}