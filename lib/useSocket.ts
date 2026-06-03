// lib/useSocket.ts
import { useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react'

let socket: Socket | null = null

export function useSocket() {
  const { data: session } = useSession()
  const role = (session?.user as Record<string, unknown>)?.role as string

  useEffect(() => {
    if (!role) return
    fetch('/api/socket').finally(() => {
      if (!socket) {
        socket = io({ path: '/api/socket', addTrailingSlash: false })
      }
      socket.emit('join-role', role)
    })
  }, [role])

  return socket
}
