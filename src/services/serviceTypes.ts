export type ServiceErrorCode =
  | 'disabled'
  | 'consent_required'
  | 'offline'
  | 'invalid_request'
  | 'timeout'
  | 'unavailable'
  | 'invalid_response'

export interface SafeServiceError {
  code: ServiceErrorCode
  /** Intentionally generic: provider error bodies must never reach the UI. */
  message: string
  retryable: boolean
}

export interface SafeServiceMeta {
  source?: 'ai' | 'fallback' | 'providers' | 'worker'
  attempts?: number
  cache?: 'hit' | 'miss'
}

export type ServiceResult<T> =
  | { ok: true; data: T; fallback: false; meta?: SafeServiceMeta }
  | { ok: false; error: SafeServiceError; fallback?: T }

const MESSAGES: Record<ServiceErrorCode, string> = {
  disabled: 'AI 功能尚未啟用，仍可使用本地功能。',
  consent_required: '請先閱讀並同意 AI 資料使用說明；本地功能不受影響。',
  offline: '目前沒有網路，已保留本地資料與離線功能。',
  invalid_request: '送出的資料格式不完整，請檢查後再試。',
  timeout: '服務回應逾時，已保留本地資料。',
  unavailable: '服務暫時無法連線，已保留本地資料。',
  invalid_response: '服務回傳格式無法安全使用，已改用本地結果。'
}

export const safeServiceError = (code: ServiceErrorCode): SafeServiceError => ({
  code,
  message: MESSAGES[code],
  retryable: code === 'timeout' || code === 'unavailable'
})
