// src/components/providers/root-provider.tsx
'use client'

import { AuthProvider } from './auth-provider'
import { IdleTimeoutProvider } from './idle-timeout-provider'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export function RootProvider({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <IdleTimeoutProvider>
          {children}
          <Toaster position="top-right" />
        </IdleTimeoutProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
