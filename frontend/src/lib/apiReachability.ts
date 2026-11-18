import { ApiError, CLIENT_ERROR_CODES } from '@/api/client'

/** Vite dev proxy returns 502 when nothing is listening on QRP_API_TARGET (default :8010). */
export function apiReachabilityMessage(status: number): string | null {
  if (status === 502 || status === 503 || status === 504) {
    return 'QRE API is not running. From the repo root run: make dev-api — or bash scripts/vm-setup.sh (QRP API on :8010; Q-TeleScope may use :8000).'
  }
  return null
}

export function enrichApiFailure(err: unknown): ApiError | Error {
  if (err instanceof ApiError) {
    const hint = apiReachabilityMessage(err.status)
    if (hint && !err.detail.includes('QRE API')) {
      return new ApiError({
        code: CLIENT_ERROR_CODES.network,
        title: err.title,
        status: err.status,
        detail: hint,
      })
    }
    return err
  }
  return err instanceof Error ? err : new Error('Request failed')
}