// src/lib/supabase/server.ts
// Server-side Supabase client for API routes and Server Components

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Force session cookies (no maxAge = expires when browser closes)
              const sessionOptions = {
                ...options,
                maxAge: undefined, // Remove maxAge to make it a session cookie
                expires: undefined, // Remove expires to make it a session cookie
              }
              cookieStore.set(name, value, sessionOptions)
            })
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}