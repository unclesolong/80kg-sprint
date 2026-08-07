export interface RateLimitRule {
  limit: number
  windowMs: number
}

interface Bucket {
  count: number
  resetAt: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
  resetAt: number
}

const hashIdentifier = (value: string) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export const requestFingerprint = (request: Request) => {
  const ip = request.headers.get('CF-Connecting-IP')?.slice(0, 64) ?? 'unknown-ip'
  const device = request.headers.get('X-Device-Id')?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'unknown-device'
  return hashIdentifier(`${ip}:${device}`)
}

export class MemoryRateLimiter {
  private buckets = new Map<string, Bucket>()

  constructor(private readonly now: () => number = Date.now) {}

  consume(key: string, rule: RateLimitRule): RateLimitResult {
    const now = this.now()
    const existing = this.buckets.get(key)
    const bucket = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + rule.windowMs }
      : existing
    bucket.count += 1
    this.buckets.set(key, bucket)

    if (this.buckets.size > 2_000) this.prune(now)
    const allowed = bucket.count <= rule.limit
    return {
      allowed,
      remaining: Math.max(0, rule.limit - bucket.count),
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
      resetAt: bucket.resetAt,
    }
  }

  private prune(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key)
    }
  }
}

export const RATE_LIMITS: Record<string, RateLimitRule> = {
  '/v1/plan/generate': { limit: 4, windowMs: 60 * 60 * 1_000 },
  '/v1/review/weekly': { limit: 8, windowMs: 60 * 60 * 1_000 },
  '/v1/food/parse': { limit: 30, windowMs: 10 * 60 * 1_000 },
  '/v1/food/search': { limit: 60, windowMs: 10 * 60 * 1_000 },
}
