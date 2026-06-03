// components/Layout.tsx

import { type ReactNode, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useSession, signOut } from 'next-auth/react'
import ToastNotification from './ToastNotification'

function Icon({ path, className = '' }: { path: string; className?: string }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d={path} />
    </svg>
  )
}

const ICONS: Record<string, string> = {
  requests:  'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2',
  new_req:   'M12 5v14M5 12h14',
  inventory: 'M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 21V5a2 2 0 0 1 2-2h2',
  new_inv:   'M12 5v14M5 12h14',
  clusters:  'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  transfers: 'M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4',
  logs:      'M4 6h16M4 10h16M4 14h8',
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  forecast:  'M2 20h20M5 20V10l7-7 7 7v10',
  report:    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  settings:  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  health:    'M22 12h-4l-3 9L9 3l-3 9H2',
  backup:    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  import:    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  audit:     'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  users:     'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  signout:   'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1',
  moon:      'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  sun:       'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 1 0 0 14A7 7 0 0 0 12 5z',
  chevron:   'M6 9l6 6 6-6',
  approvals: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
}

type NavLinkDef = {
  href: string
  label: string
  icon: string
  roles: string[]
  zone: 'ops' | 'analytics'
}

type SystemLinkDef = {
  href?: string
  label: string
  icon: string
  roles: string[]
  action?: 'signout' | 'theme'
  danger?: boolean
  divider?: boolean
}

const NAV_LINKS: NavLinkDef[] = [
  { href: '/requests',            label: 'Requests',      icon: 'requests',  roles: ['BREEDER','BIOTECHNOLOGIST', 'ADMIN','MANAGEMENT'],                             zone: 'ops' },
  { href: '/requests/new',        label: 'New Request',   icon: 'new_req',   roles: ['BREEDER', 'ADMIN','MANAGEMENT'],                                               zone: 'ops' },
  { href: '/approvals',           label: 'Approvals',     icon: 'approvals', roles: ['BREEDER','BIOTECHNOLOGIST', 'ADMIN','MANAGEMENT'],                             zone: 'ops' },
  { href: '/inventory',           label: 'Inventory',     icon: 'inventory', roles: ['BIOTECHNOLOGIST', 'INVENTORY_MANAGER','ADMIN','MANAGEMENT'],                   zone: 'ops' },
  { href: '/inventory/new',       label: 'New Inventory', icon: 'new_inv',   roles: ['INVENTORY_MANAGER','ADMIN','MANAGEMENT'],                                      zone: 'ops' },
  { href: '/inventory/clusters',  label: 'Clusters',      icon: 'clusters',  roles: ['BREEDER','BIOTECHNOLOGIST', 'INVENTORY_MANAGER','ADMIN','MANAGEMENT'],         zone: 'ops' },
  { href: '/inventory/transfers', label: 'Transfers',     icon: 'transfers', roles: ['BIOTECHNOLOGIST', 'INVENTORY_MANAGER','ADMIN','MANAGEMENT'],                   zone: 'ops' },
  { href: '/inventory/logs',      label: 'Usage Logs',    icon: 'logs',      roles: ['BIOTECHNOLOGIST', 'INVENTORY_MANAGER','ADMIN','MANAGEMENT'],                   zone: 'ops' },
  { href: '/dashboard',           label: 'Dashboard',     icon: 'dashboard', roles: ['BREEDER','BIOTECHNOLOGIST', 'INVENTORY_MANAGER','ADMIN','MANAGEMENT'],         zone: 'analytics' },
  { href: '/inventory/forecast',  label: 'Forecast',      icon: 'forecast',  roles: ['BREEDER','BIOTECHNOLOGIST', 'INVENTORY_MANAGER','ADMIN','MANAGEMENT'],         zone: 'analytics' },
  { href: '/reports/monthly',     label: 'Reports',       icon: 'report',    roles: ['BIOTECHNOLOGIST', 'INVENTORY_MANAGER','ADMIN','MANAGEMENT'],                   zone: 'analytics' },
  
]

const SYSTEM_LINKS: SystemLinkDef[] = [
  { href: '/account/settings',  label: 'Settings',      icon: 'settings', roles: ['BREEDER','BIOTECHNOLOGIST','INVENTORY_MANAGER','MANAGEMENT','ADMIN'] },
  { href: '/admin/import',      label: 'Import Data',   icon: 'import',   roles: ['ADMIN','INVENTORY_MANAGER'] },
  { href: '/admin/audit',       label: 'Audit Log',     icon: 'audit',    roles: ['ADMIN'] },
  { href: '/admin/users',       label: 'Users',         icon: 'users',    roles: ['ADMIN'] },
  { href: '/admin/health',      label: 'System Health', icon: 'health',   roles: ['ADMIN'] },
  { href: '/admin/backup',      label: 'Backups',       icon: 'backup',   roles: ['ADMIN'] },
  { label: '—', icon: '', roles: ['BREEDER','BIOTECHNOLOGIST','INVENTORY_MANAGER','MANAGEMENT','ADMIN'], divider: true },
  { label: 'Theme',    icon: 'moon',    roles: ['BREEDER','BIOTECHNOLOGIST','INVENTORY_MANAGER','MANAGEMENT','ADMIN'], action: 'theme' },
  { label: 'Sign out', icon: 'signout', roles: ['BREEDER','BIOTECHNOLOGIST','INVENTORY_MANAGER','MANAGEMENT','ADMIN'], action: 'signout', danger: true },
]

function NavItem({ href, label, icon, isActive }: {
  href: string; label: string; icon: string; isActive: boolean
}) {
  return (
    <Link
      href={href}
      className={`
        relative flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium
        whitespace-nowrap transition-all duration-150 rounded-lg
        ${isActive
          // ── Active pill: biotech teal-emerald, not neon green ──
          ? 'bg-linear-to-r from-[#14b8a6] to-[#0f9f8f] text-white shadow-[0_4px_14px_rgba(20,184,166,0.22)]'
          : 'text-[#5f6b7a] dark:text-gray-400 hover:text-[#111827] dark:hover:text-gray-200 hover:bg-black/4 dark:hover:bg-white/5'
        }
      `}
    >
      <span className={`transition-colors duration-150 ${
        isActive ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'
      }`}>
        <Icon path={ICONS[icon] ?? ICONS.requests} />
      </span>
      {label}
    </Link>
  )
}

function Avatar({ name }: { name?: string | null }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  return (
    // ── Avatar: same biotech teal-emerald gradient as logo ──
    <div className="w-7 h-7 rounded-lg bg-linear-to-br from-[#14b8a6] to-[#0f9f8f] flex items-center justify-center text-white text-[11px] font-bold tracking-wide shrink-0 shadow-sm">
      {initials}
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const router = useRouter()

  const role = (session?.user as Record<string, unknown>)?.role as string
  const isAuthPage = router.pathname === '/login'

  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => { const t = setTimeout(() => setProfileOpen(false), 0); return () => clearTimeout(t) }, [router.pathname])

  const visibleNav     = NAV_LINKS.filter(l => !role || l.roles.includes(role))
  const opsLinks       = visibleNav.filter(l => l.zone === 'ops')
  const analyticsLinks = visibleNav.filter(l => l.zone === 'analytics')
  const systemLinks    = SYSTEM_LINKS.filter(l => !role || l.roles.includes(role))

  return (
    <div className="min-h-screen overflow-y-auto text-gray-800 dark:text-gray-100">
      <ToastNotification />

      {/* ── Ambient blobs: teal-emerald family, not cyan/green ── */}
      {!isAuthPage && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-15%] right-[-8%] w-125 h-125 bg-[#14b8a6]/5 dark:bg-[#14b8a6]/3 rounded-full blur-3xl" />
          <div className="absolute bottom-[-20%] left-[-10%] w-112.5 h-112.5 bg-[#0f9f8f]/5 dark:bg-[#0f9f8f]/3 rounded-full blur-3xl" />
        </div>
      )}

      {/* ── Navbar ── */}
      {!isAuthPage && session && (
        <nav className="
          sticky top-0 z-50
          h-14
          flex items-center justify-between
          px-6
          bg-[#f8fbfa]/95 dark:bg-gray-900/95
          backdrop-blur-xl
          border-b border-[rgba(20,184,166,0.18)] dark:border-[rgba(20,184,166,0.12)]
          shadow-[0_1px_0_rgba(20,184,166,0.08)]
        ">

          {/* ── LEFT: Brand + nav ── */}
          <div className="flex items-center gap-0 min-w-0 h-full">

            {/* Brand */}
            <Link href="/" className="flex items-center gap-2.5 pr-6 shrink-0 group">
              {/* ── Logo tile: teal-emerald, controlled saturation ── */}
              <div className="w-7 h-7 rounded-lg bg-linear-to-br from-[#14b8a6] to-[#0f9f8f] flex items-center justify-center shadow-sm">
                <svg width="14" height="14" viewBox="0 0 40 40" fill="none">
                  <path d="M20 32 Q10 22 14 10 Q20 6 26 10 Q34 18 20 32Z" fill="white" fillOpacity="0.95" />
                  <path d="M20 9 Q25 13 20 18 Q15 23 20 27" stroke="rgba(255,255,255,0.7)" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
                  <path d="M20 9 Q15 13 20 18 Q25 23 20 27" stroke="rgba(255,255,255,0.45)" strokeWidth="2" fill="none" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[13px] font-bold text-gray-800 dark:text-gray-100 tracking-tight group-hover:text-[#0f9f8f] dark:group-hover:text-[#14b8a6] transition-colors">
                  GenomicLab
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mt-0.5">
                  Lab System
                </span>
              </div>
            </Link>

            {/* Ops group */}
            {opsLinks.length > 0 && (
              // ── Vertical separator: muted teal, not gray or neon ──
              <div className="flex items-center gap-0.5 border-l border-[rgba(20,184,166,0.18)] dark:border-[rgba(20,184,166,0.12)] pl-4 h-full">
                {opsLinks.map(l => (
                  <NavItem key={l.href} {...l} isActive={router.pathname === l.href} />
                ))}
              </div>
            )}

            {/* Group separator */}
            {analyticsLinks.length > 0 && opsLinks.length > 0 && (
              // ── Mid-nav divider: teal tint ──
              <div className="mx-3 h-4 w-px bg-[#14b8a6]/18 dark:bg-[#14b8a6]/12 shrink-0" />
            )}

            {/* Analytics group */}
            {analyticsLinks.length > 0 && (
              <div className="flex items-center gap-0.5">
                {analyticsLinks.map(l => (
                  <NavItem key={l.href} {...l} isActive={router.pathname === l.href} />
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: Profile cluster ── */}
          <div className="flex items-center" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(v => !v)}
              className={`
                flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-lg
                transition-colors duration-150
                ${profileOpen
                  ? 'bg-black/5 dark:bg-white/7'
                  : 'hover:bg-black/4 dark:hover:bg-white/5'
                }
              `}
            >
              <Avatar name={session.user?.name} />
              <div className="hidden sm:flex flex-col items-start leading-none">
                <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                  {session.user?.name?.split(' ')[0] ?? 'User'}
                </span>
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-0.5">
                  {role}
                </span>
              </div>
              <svg
                width="11" height="11" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                className={`text-gray-400 transition-transform duration-200 ml-0.5 ${profileOpen ? 'rotate-180' : ''}`}
              >
                <path d={ICONS.chevron} />
              </svg>
            </button>

            {/* ── Dropdown: teal-tinted border + shadow, no neon glow ── */}
            {profileOpen && (
              <div className="
                absolute top-[calc(100%+8px)] right-4
                w-56
                bg-white dark:bg-gray-900
                border border-[rgba(20,184,166,0.20)] dark:border-[rgba(20,184,166,0.14)]
                rounded-2xl
                shadow-[0_20px_40px_rgba(20,184,166,0.08),0_4px_16px_rgba(15,23,42,0.08)]
                py-3
                z-50
                origin-top-right
              ">
                {/* Account header */}
                <div className="px-4 pb-2.5 border-b border-[rgba(20,184,166,0.14)] dark:border-[rgba(20,184,166,0.10)] flex items-center gap-3">
                  <Avatar name={session.user?.name} />
                  <div className="flex flex-col leading-none min-w-0">
                    <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">
                      {session.user?.name}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                      {session.user?.email}
                    </span>
                  </div>
                </div>

                <div className="pt-1.5 px-1.5">
                  {systemLinks.map((l, i) => {
                    if (l.divider) {
                      // ── Dropdown divider: teal tint ──
                      return <div key={i} className="my-1.5 h-px bg-[#14b8a6]/14 dark:bg-[#14b8a6]/10 mx-2" />
                    }



                    if (l.action === 'signout') {
                      return (
                        <button
                          key={i}
                          onClick={() => signOut({ callbackUrl: '/login' })}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[13px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors duration-150"
                        >
                          <Icon path={ICONS.signout} />
                          Sign out
                        </button>
                      )
                    }

                    if (!l.href) return null
                    const isActive = router.pathname === l.href

                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setProfileOpen(false)}
                        className={`
                          group flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[13px] font-medium
                          transition-colors duration-150
                          ${isActive
                            // ── Active dropdown item: teal tint, not emerald-50 ──
                            ? 'bg-[#14b8a6]/10 dark:bg-[#14b8a6]/15 text-[#0f9f8f] dark:text-[#14b8a6]'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                          }
                        `}
                      >
                        <span className={`transition-colors ${isActive ? 'text-[#14b8a6]' : 'text-gray-400 group-hover:text-gray-500'}`}>
                          <Icon path={ICONS[l.icon] ?? ''} />
                        </span>
                        {l.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* ── Page content ── */}
      <main className="relative z-10 w-full min-h-[calc(100vh-3.5rem)]">
        {children}
      </main>
    </div>
  )
}