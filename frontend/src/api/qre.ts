/**
 * Portal client for the module endpoints under `/api/v1` (inventory, approvals, projects, pools,
 * dispatch, …).
 *
 * RBAC-7g: authenticated module calls go through `api/client.ts` (cookie session + in-memory CSRF) —
 * the old `X-User-Role` header-trust and localStorage role are gone. `authFetch` remains for the
 * genuinely unauthenticated public endpoints (login, register, password reset, captcha).
 */
import { ApiError, apiRequest } from '@/api/client'

/** Back-compat alias: existing callers import `QreError`; it is now the shared `ApiError`. */
export { ApiError as QreError }

/** Call a module endpoint (authenticated). Body (if any) must be a JSON string, as before. */
export async function qre<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  let json: unknown
  if (init.body != null) {
    json = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
  }
  const { data } = await apiRequest<T>(`/api/v1${path}`, { method, json })
  return data
}

function problemDetail(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const d = (body as { detail: unknown }).detail
    if (typeof d === 'string' && d) return d
  }
  return fallback
}

/** Unauthenticated fetch for public endpoints (login/register/password-reset/captcha). */
export async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const h = new Headers({ Accept: 'application/json' })
  if (init.body) h.set('Content-Type', 'application/json')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  if (init.signal) init.signal.addEventListener('abort', () => controller.abort(), { once: true })
  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, { ...init, headers: h, signal: controller.signal })
  } catch (err) {
    clearTimeout(timer)
    const msg =
      err instanceof DOMException && err.name === 'AbortError'
        ? 'API timeout. Is the backend running on port 8080?'
        : 'API unreachable. Is the backend running on port 8080?'
    throw new ApiError({ code: 'NETWORK_ERROR', title: 'Network error', detail: msg, status: 0 })
  } finally {
    clearTimeout(timer)
  }
  const textBody = await response.text()
  let body: unknown = null
  try {
    body = textBody ? JSON.parse(textBody) : null
  } catch {
    body = null
  }
  if (!response.ok) {
    throw new ApiError({
      code: 'REQUEST_FAILED',
      title: 'Request failed',
      detail: problemDetail(body, response.statusText || `Request failed (${response.status})`),
      status: response.status,
    })
  }
  return body as T
}

export function asList(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[]
  if (body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)) {
    return (body as { items: Record<string, unknown>[] }).items
  }
  return []
}

export function text(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (value == null || value === '') return '—'
  return String(value)
}

/**
 * Download a CSV (or other text) endpoint under `/api/v1`. GET only, so no CSRF token is needed; the
 * session cookie is sent same-origin. Errors surface as `ApiError`.
 */
export async function qreDownload(path: string, filename: string): Promise<void> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: 'same-origin',
    headers: { Accept: 'text/csv,*/*' },
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new ApiError({ code: 'DOWNLOAD_FAILED', title: 'Download failed', detail: detail || response.statusText, status: response.status })
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
