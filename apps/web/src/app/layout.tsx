import '@fontsource-variable/onest'
import '@fontsource-variable/schibsted-grotesk'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './globals.css'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { SCRIPT_THEME } from '@/lib/theme'

export const metadata: Metadata = {
  title: { default: 'Pastille', template: '%s · Pastille' },
  description: 'Facturation électronique conforme pour indépendants, TPE et PME.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Pastille', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1221' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
