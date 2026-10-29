// src/lib/rate-limit-server.ts
// Client-side helper for server-side rate limiting
//
// This replaces the client-side only rate limiter with
// proper server-side checks that cannot be bypassed.

interface RateLimitResponse {
  allowed: boolean
  remaining?: number
  resetTime?: number
  lockedUntil?: number
  retryAfter?: number
  error?: string
}

/**
 * Check if an action is rate limited (server-side)
 *
 * @param identifier - Email or unique identifier
 * @param type - Type of action ('login' or 'signup')
 * @returns Promise with rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  type: 'login' | 'signup' = 'login'
): Promise<RateLimitResponse> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch('/api/auth/rate-limit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, type }),
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const data = await response.json()

    return {
      allowed: response.ok,
      ...data,
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    // On error, allow the request to proceed
    // (fail open to avoid blocking legitimate users)
    return {
      allowed: true,
      error: 'Rate limit check failed',
    }
  }
}

/**
 * Reset rate limit for a user (after successful auth)
 *
 * @param identifier - Email or unique identifier
 * @param type - Type of action ('login' or 'signup')
 */
export async function resetRateLimit(
  identifier: string,
  type: 'login' | 'signup' = 'login'
): Promise<void> {
  try {
    await fetch('/api/auth/rate-limit', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, type }),
    })
  } catch (error) {
    console.error('Rate limit reset failed:', error)
    // Silent fail - not critical if reset fails
  }
}
