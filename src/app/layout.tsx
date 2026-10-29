// src/app/layout.tsx
// Root layout - wraps entire app

import type { Metadata } from 'next'
import { Mulish } from 'next/font/google'
import './globals.css'

const mulish = Mulish({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mulish'
})

export const metadata: Metadata = {
  title: 'NET Personal Training',
  description: 'Professional personal training management platform',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${mulish.className} flex flex-col min-h-screen`}>
        <div className="flex-1">{children}</div>
        <footer className="border-t bg-white py-3 px-4 text-center text-xs text-slate-400">
          Proprietary to New Element Training Ltd. No part of this application may be copied, shared or redistributed without explicit consent from the owner.
        </footer>
      </body>
    </html>
  )
}