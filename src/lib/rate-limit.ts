// src/lib/rate-limit.ts
// Rate limiting implementation to prevent brute force attacks

interface RateLimitStore {
  count: number
  resetTime: number
  lockedUntil?: number
}

// In-memory store (consider using Redis for production multi-instance deployments)
const store = new Map<string, RateLimitStore>()

interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
  lockoutDurationMs?: number
}

/**
 * Rate limiter for authentication endpoints
 * @param identifier - Unique identifier (email or IP)
 * @param config - Rate limit configuration
 * @returns { success: boolean, remaining: number, resetTime: number, lockedUntil?: number }
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutDurationMs: 15 * 60 * 1000, // 15 minutes lockout
  }
): {
  success: boolean
  remaining: number
  resetTime: number
  lockedUntil?: number
} {
  const now = Date.now()
  const key = `ratelimit:${identifier}`

  let record = store.get(key)

  // Check if account is locked
  if (record?.lockedUntil && record.lockedUntil > now) {
    return {
      success: false,
      remaining: 0,
      resetTime: record.resetTime,
      lockedUntil: record.lockedUntil,
    }
  }

  // Reset if window has expired or account was locked but lockout expired
  if (!record || record.resetTime < now || (record.lockedUntil && record.lockedUntil <= now)) {
    record = {
      count: 0,
      resetTime: now + config.windowMs,
    }
  }

  record.count++

  // Check if exceeded max attempts
  if (record.count > config.maxAttempts) {
    if (config.lockoutDurationMs) {
      record.lockedUntil = now + config.lockoutDurationMs
    }
    store.set(key, record)

    return {
      success: false,
      remaining: 0,
      resetTime: record.resetTime,
      lockedUntil: record.lockedUntil,
    }
  }

  store.set(key, record)

  return {
    success: true,
    remaining: config.maxAttempts - record.count,
    resetTime: record.resetTime,
  }
}

/**
 * Reset rate limit for an identifier (use after successful login)
 */
export function resetRateLimit(identifier: string): void {
  const key = `ratelimit:${identifier}`
  store.delete(key)
}

/**
 * Clean up expired entries (run periodically)
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, record] of store.entries()) {
    if (record.resetTime < now && (!record.lockedUntil || record.lockedUntil < now)) {
      store.delete(key)
    }
  }
}

// Clean up expired entries every 5 minutes
if (typeof window === 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000)
}
