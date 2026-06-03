'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { signIn } from 'next-auth/react'

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
      callbackUrl: '/dashboard',
    })

    setLoading(false)

    if (result?.error) {
      setError('Invalid email or password. Please try again.')
    } else if (result?.url) {
      window.location.href = result.url
    }
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-[#f4f7f5]">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/bg-leaf2.png"
          alt="Background"
          fill
          priority
          quality={100}
          sizes="100vw"
          className="object-cover object-center w-full h-full"
        />
      </div>

      <div className="absolute inset-0 bg-linear-to-r from-white/8 via-transparent to-black/20" />

      {/* Main */}
      <div className="relative z-10 flex h-full items-center justify-end pr-[4vw]">
        <div className="absolute inset-y-0 left-[38%] w-px bg-white/10 blur-sm" />

        {/* Login Card */}
        <div className="relative z-10 w-full max-w-md">
          <div className="relative overflow-hidden bg-white/12 backdrop-blur-2xl rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.38),0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.14)] border border-white/20 px-8 py-7 max-h-[92vh]">

            <div className="absolute inset-0 bg-black/10 rounded-3xl pointer-events-none" />

            {/* Logo */}
            <div className="relative z-10 flex flex-col items-center mb-5">
              <div className="w-24 h-24 rounded-4xl bg-linear-to-r from-white/75 to-white/20 flex items-center justify-center mb-8 shadow-[0_25px_80px_rgba(255,255,255,0.16)] backdrop-blur-md">
                <svg width="2500" height="2500" viewBox="0 0 40 40" fill="none">
                  <path d="M20 32 Q10 22 14 10 Q20 6 26 10 Q34 18 20 32Z" fill="url(#leafFill)" />
                  <path d="M20 8 Q26 13 20 18 Q14 23 20 28" stroke="#3b82f6" strokeWidth="2.6" fill="none" strokeLinecap="round" />
                  <path d="M20 8 Q14 13 20 18 Q26 23 20 28" stroke="#22c55e" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <line x1="15" y1="11" x2="25" y2="11" stroke="#94a3b8" strokeWidth="1.4" />
                  <line x1="14" y1="15" x2="26" y2="15" stroke="#94a3b8" strokeWidth="1" />
                  <line x1="15" y1="19" x2="25" y2="19" stroke="#94a3b8" strokeWidth="1" />
                  <line x1="14" y1="23" x2="26" y2="23" stroke="#94a3b8" strokeWidth="1" />
                  <defs>
                    <linearGradient id="leafFill" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#86efac" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#4ade80" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <h1 className="text-[2.4rem] leading-none font-extrabold tracking-tight drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]">
                <span className="text-white">Agri</span>
                <span className="text-cyan-100">Genomics</span>
              </h1>

              <p className="text-xs tracking-[0.25em] text-gray-400 uppercase mt-0.5">
                Lab System
              </p>

              <div className="mt-2 w-8 h-0.5 bg-linear-to-r from-green-400 to-cyan-400 rounded" />
            </div>

            <p className="relative z-10 text-center text-sm text-white/70 mb-8">
              Welcome! Please login to continue.
            </p>

            <form onSubmit={handleSubmit} className="relative z-10 space-y-4">

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/20 border border-red-400/30 text-red-200 text-sm">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Email / Username */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Username or Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-white/15 bg-white/10 text-sm text-white placeholder-white/45 focus:outline-none focus:ring-2 focus:ring-cyan-300/30 focus:border-white/20 transition"
                />
              </div>

              {/* Password — wrapper is position:relative, overflow:hidden so nothing bleeds out */}
              <div style={{ position: 'relative' }}>
                {/* Lock icon */}
                <span style={{
                  position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                  color: '#9ca3af', pointerEvents: 'none', zIndex: 2,
                  display: 'flex', alignItems: 'center',
                }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </span>

                {/* Input — no backdrop-blur, no overflow artifacts */}
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="hide-password-toggle"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  style={{
                    width: '100%',
                    paddingLeft: 44,
                    paddingRight: 44,
                    paddingTop: 12,
                    paddingBottom: 12,
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.10)',
                    fontSize: 14,
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />

                {/* Eye toggle — solid background so glass doesn't bleed through */}
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    zIndex: 2,
                    borderRadius: '0 16px 16px 0',
                  }}
                >
                  {showPassword ? (
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="relative overflow-hidden w-full py-3.5 rounded-2xl text-white font-semibold tracking-wide flex items-center justify-center gap-2 shadow-[0_10px_40px_rgba(34,197,94,0.30)] hover:scale-[1.02] active:scale-[0.99] disabled:opacity-70 transition-all duration-300"
                style={{ background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 40%, #06b6d4 100%)' }}
              >
                <div className="absolute inset-0 bg-linear-to-r from-white/20 via-transparent to-transparent opacity-40" />
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <span className="relative z-10 flex items-center gap-2">
                    Sign In
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                )}
              </button>
              <style jsx>{`
                .hide-password-toggle::-ms-reveal,
                .hide-password-toggle::-ms-clear {
                  display: none;
                }
                .hide-password-toggle::-webkit-credentials-auto-fill-button {
                  visibility: hidden;
                  display: none !important;
                  pointer-events: none;
                }
              `}</style>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
