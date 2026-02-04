import React from "react"
import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { FeedbackWidget } from '@/components/feedback-widget'
import { appFonts } from './fonts'
import './globals.css'

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: 'OffDaWall - Discover Underground Hip-Hop',
  description: 'Explore top and upcoming artists across every hip-hop subgenre. From trap to boom bap, drill to cloud rap.',
  generator: 'OffDaWallV2',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png?v=2',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png?v=2',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg?v=2',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png?v=2',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${appFonts.sans.variable} ${appFonts.mono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {children}
        <FeedbackWidget />
        <Analytics />
      </body>
    </html>
  )
}

