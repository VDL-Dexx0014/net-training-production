// src/app/template.tsx
// Template that wraps all pages with providers
'use client'

import { RootProvider } from '@/components/providers/root-provider'

// Force dynamic rendering to prevent SSG issues with client hooks
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export default function Template({ children }: { children: React.ReactNode }) {
  return <RootProvider>{children}</RootProvider>
}
