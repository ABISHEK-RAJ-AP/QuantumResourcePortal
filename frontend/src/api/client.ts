/**
 * Minimal API client for the QRE backend (LLD §8.1, §10.2).
 *
 * - Same-origin requests only; the session cookie is sent automatically (credentials: same-origin).
 *   Nothing is ever written to localStorage (LLD §11.6).
 * - Error responses in application/problem+json become `ApiError` with code, title, detail,
 *   correlation id and field errors, so screens can show the message and the support reference.
 * - CSRF header injection and the 401 re-authentication flow are added in Phase 3.
 */

export interface FieldError {
  field: string
  code: string
  message: string
}

export interface ProblemBody {
  type?: string
  code: string
  title: string
  status: number
  detail?: string
  correlation_id?: string | null
  field_errors?: FieldError[]
}

/** Client-side codes for failures that never reached the API (not part of the LLD catalogue). */
export const CLIENT_ERROR_CODES = {
  network: 'NETWORK_ERROR',
  unexpectedResponse: 'UNEXPECTED_RESPONSE',
} as const

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly title: string
  readonly detail: string
  readonly correlationId: string | null
  readonly fieldErrors: FieldError[]

  constructor(problem: ProblemBody, correlationId: string | null = null) {
    super(problem.detail ?? problem.title)
    this.name = 'ApiError'
    this.status = problem.status
    this.code = problem.code
    this.title = problem.title
    this.detail = problem.detail ?? problem.title
    this.correlationId = problem.correlation_id ?? correlationId
    this.fieldErrors = problem.field_errors ?? []
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON-serialisable body; sets Content-Type automatically. */
  json?: unknown
  /** Extra statuses (besides 2xx) whose JSON body is returned instead of thrown, e.g. 503 from /readyz. */
  acceptStatuses?: number[]
  /** When true, a 401 does not clear the in-memory session (anonymous probe). */
  quietUnauthorized?: boolean
}

export interface ApiResponse<T> {
  status: number
  data: T
  correlationId: string | null
}

const PROBLEM_TYPE = 'application/problem+json'

async function toApiError(response: Response): Promise<ApiError> {
  const correlationId = response.headers.get('X-Correlation-ID')
  const contentType = response.headers.get('Content-Type') ?? ''
  if (contentType.includes(PROBLEM_TYPE) || contentType.includes('application/json')) {
    try {
      const body = (await response.json()) as Partial<ProblemBody>
      if (body && typeof body.code === 'string') {
        return new ApiError(
          { ...body, status: body.status ?? response.status } as ProblemBody,
          correlationId,
        )
      }
    } catch {
      // fall through to the generic error below
    }
  }
  return new ApiError(
    {
      code: CLIENT_ERROR_CODES.unexpectedResponse,
      title: 'The server returned an unexpected response.',
      status: response.status,
    },
    correlationId,
  )
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { json, acceptStatuses = [], quietUnauthorized = false, headers, ...init } = options
  const finalHeaders = new Headers(headers)
  finalHeaders.set('Accept', 'application/json')
  let body: BodyInit | undefined
  if (json !== undefined) {
    finalHeaders.set('Content-Type', 'application/json')
    body = JSON.stringify(json)
  }
  // CSRF synchroniser token on unsafe methods (LLD §11.6). The token lives in memory only; the
  // AuthProvider sets it after login and refreshes it on reload via GET /auth/csrf.
  const method = (init.method ?? 'GET').toUpperCase()
  if (_csrfToken && method !== 'GET' && method !== 'HEAD' && !finalHeaders.has('X-CSRF-Token')) {
    finalHeaders.set('X-CSRF-Token', _csrfToken)
  }

  let response: Response
  try {
    response = await fetch(path, { credentials: 'same-origin', ...init, headers: finalHeaders, body })
  } catch {
    throw new ApiError({
      code: CLIENT_ERROR_CODES.network,
      title: 'The QRP API could not be reached.',
      detail: 'Check that the backend is running and your network connection is available.',
      status: 0,
    })
  }

  // Expired/revoked session → clear UI auth. Anonymous session probes set quietUnauthorized.
  if (response.status === 401 && !quietUnauthorized) {
    _onUnauthorized?.()
  }
  if (!response.ok && !acceptStatuses.includes(response.status)) {
    throw await toApiError(response)
  }
  const data = response.status === 204 ? (undefined as T) : ((await response.json()) as T)
  return { status: response.status, data, correlationId: response.headers.get('X-Correlation-ID') }
}

/** Convenience wrapper returning only the body. */
export async function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await apiRequest<T>(path, { ...options, method: 'GET' })).data
}

// ---- CSRF token and 401 handling (set by the AuthProvider) --------------------------------------

let _csrfToken: string | null = null
let _onUnauthorized: (() => void) | null = null

/** Store the in-memory CSRF token used for unsafe requests. Never persisted (LLD §11.6). */
export function setCsrfToken(token: string | null): void {
  _csrfToken = token
}

/** Register a callback invoked when the API returns 401 (session expired/revoked). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  _onUnauthorized = handler
}
