import { safeServiceError, type SafeServiceMeta, type ServiceResult } from './serviceTypes'

export interface HttpClientOptions {
  enabled?: boolean
  baseUrl?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
  isOnline?: () => boolean
}

export interface SafeHttpClient {
  readonly configured: boolean
  request(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown; aiConsent?: boolean }): Promise<ServiceResult<unknown>>
}

const isSafeBaseUrl = (raw: string) => {
  try {
    const value = new URL(raw)
    const local = value.hostname === 'localhost' || value.hostname === '127.0.0.1' || value.hostname === '[::1]'
    return !value.username && !value.password && !value.search && !value.hash && (value.protocol === 'https:' || (local && value.protocol === 'http:'))
  } catch {
    return false
  }
}

const defaultEnabled = () => import.meta.env.VITE_AI_ENABLED === 'true'
const defaultBaseUrl = () => import.meta.env.VITE_AI_API_BASE_URL ?? ''

const unwrapSuccessEnvelope = (value: unknown): { valid: true; data: unknown; meta: SafeServiceMeta } | { valid: false } => {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return { valid: false }
  const envelope = value as Record<string, unknown>
  if (envelope.ok !== true || !('data' in envelope) || envelope.meta == null || typeof envelope.meta !== 'object' || Array.isArray(envelope.meta)) return { valid: false }
  if (Object.keys(envelope).some((key) => !['ok', 'data', 'meta'].includes(key))) return { valid: false }
  const rawMeta = envelope.meta as Record<string, unknown>
  const source = ['ai', 'fallback', 'providers', 'worker'].includes(String(rawMeta.source))
    ? rawMeta.source as SafeServiceMeta['source']
    : undefined
  const attempts = typeof rawMeta.attempts === 'number' && Number.isInteger(rawMeta.attempts) && rawMeta.attempts >= 0 && rawMeta.attempts <= 2
    ? rawMeta.attempts
    : undefined
  const cache = rawMeta.cache === 'hit' || rawMeta.cache === 'miss' ? rawMeta.cache : undefined
  return { valid: true, data: envelope.data, meta: { source, attempts, cache } }
}

export const createSafeHttpClient = (options: HttpClientOptions = {}): SafeHttpClient => {
  const enabled = options.enabled ?? defaultEnabled()
  const rawBaseUrl = (options.baseUrl ?? defaultBaseUrl()).trim().replace(/\/+$/, '')
  const configured = enabled && isSafeBaseUrl(rawBaseUrl)
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 12_000, 1_000), 30_000)
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const isOnline = options.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false)

  return {
    configured,
    async request(path, init = {}) {
      if (!configured || typeof fetchImpl !== 'function') return { ok: false, error: safeServiceError('disabled') }
      if (!isOnline()) return { ok: false, error: safeServiceError('offline') }
      if (!/^\/v1\/[a-z/]+$/.test(path)) return { ok: false, error: safeServiceError('invalid_request') }
      const method = init.method ?? 'GET'
      let body: string | undefined
      if (method === 'POST') {
        try {
          body = JSON.stringify(init.body)
        } catch {
          return { ok: false, error: safeServiceError('invalid_request') }
        }
        if (!body || body.length > 32_000) return { ok: false, error: safeServiceError('invalid_request') }
      }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetchImpl(`${rawBaseUrl}${path}`, {
          method,
          body,
          signal: controller.signal,
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          headers: method === 'POST'
            ? { Accept: 'application/json', 'Content-Type': 'application/json', ...(init.aiConsent ? { 'X-AI-Consent': 'granted' } : {}) }
            : { Accept: 'application/json' }
        })
        if (!response.ok) return { ok: false, error: safeServiceError(response.status === 408 || response.status === 504 ? 'timeout' : 'unavailable') }
        const raw = await response.text()
        if (raw.length > 256_000) return { ok: false, error: safeServiceError('invalid_response') }
        try {
          const envelope = unwrapSuccessEnvelope(JSON.parse(raw) as unknown)
          return envelope.valid
            ? { ok: true, data: envelope.data, fallback: false, meta: envelope.meta }
            : { ok: false, error: safeServiceError('invalid_response') }
        } catch {
          return { ok: false, error: safeServiceError('invalid_response') }
        }
      } catch (error) {
        const timedOut = typeof error === 'object' && error != null && 'name' in error && error.name === 'AbortError'
        return { ok: false, error: safeServiceError(timedOut ? 'timeout' : 'unavailable') }
      } finally {
        clearTimeout(timeout)
      }
    }
  }
}
