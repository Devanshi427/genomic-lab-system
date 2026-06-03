// pages/_app.tsx

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { SessionProvider } from 'next-auth/react'
import Layout from '../components/Layout'

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      {/*
        Background: very soft warm-green tint.
        Atmospheric but NOT competing with content.
        Dark mode: deep gray, handled by globals.css on <html>.
      */}
      <div className="min-h-screen bg-[#f0f4f1] dark:bg-gray-900">
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </div>
    </SessionProvider>
  )
}