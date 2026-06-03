// pages/index.tsx
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (session) {
      const role = (session.user as Record<string, unknown>)?.role as string
      if (role === 'INVENTORY_MANAGER') router.push('/inventory')
      else if (role === 'MANAGEMENT') router.push('/dashboard')
      else router.push('/requests')
    } else {
      router.push('/login')
    }
  }, [session, status, router])

  return <div className="flex items-center justify-center h-screen text-gray-400">Redirecting...</div>
}