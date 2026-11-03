/** Portal client for `/api/v1`. Uses the signed-in session when present. */

import { getSessionUser, getToken } from '@/lib/session'

const ROLE_KEY = 'qre_role'
const NAME_KEY = 'qre_user'

export const ROLES = ['Admin', 'Researcher', 'Operator', 'Auditor'] as const

export function currentRole() {
  return getSessionUser()?.role || localStorage.getItem(ROLE_KEY) || 'Admin'
}

export function setRole(role: string) {
  localStorage.setItem(ROLE_KEY, role)
  if (!localStorage.getItem(NAME_KEY)) localStorage.setItem(NAME_KEY, role)
}

function headers(): Headers {
  const session = getSessionUser()
  const role = session?.role || currentRole()
  const name = session?.username || localStorage.getItem(NAME_KEY) || role
  const h = new Headers()
  h.set('Accept', 'application/json')
  h.set('X-User-Role', role)
  h.set('X-User-Name', name)
  const token = getToken()
  if (token) h.set('Authorization', `Bearer ${token}`)
  return h
}

export class QreError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'QreError'
    this.status = status
  }
}

export async function qre<T>(path: string, init: RequestInit = {}): Promise<T> {
  const h = headers()
  if (init.body) h.set('Content-Type', 'application/json')
  const response = await fetch(`/api/v1${path}`, { ...init, headers: h })
  const textBody = await response.text()
  let body: unknown = null
  try {
    body = textBody ? JSON.parse(textBody) : null
  } catch {
    body = null
  }
  if (!response.ok) {
    const detail =
      body && typeof body === 'object' && 'detail' in body && typeof (body as { detail: unknown }).detail === 'string'
        ? (body as { detail: string }).detail
        : response.statusText
    throw new QreError(response.status, detail || `Request failed (${response.status})`)
  }
  return body as T
}

/** Unauthenticated fetch for login/register/captcha. */
export async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const h = new Headers({ Accept: 'application/json' })
  if (init.body) h.set('Content-Type', 'application/json')
  const response = await fetch(`/api/v1${path}`, { ...init, headers: h })
  const textBody = await response.text()
  let body: unknown = null
  try {
    body = textBody ? JSON.parse(textBody) : null
  } catch {
    body = null
  }
  if (!response.ok) {
    const detail =
      body && typeof body === 'object' && 'detail' in body && typeof (body as { detail: unknown }).detail === 'string'
        ? (body as { detail: string }).detail
        : response.statusText
    throw new QreError(response.status, detail || `Request failed (${response.status})`)
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

/** Download a CSV (or other text) endpoint under `/api/v1` using session headers. */
export async function qreDownload(path: string, filename: string): Promise<void> {
  const h = headers()
  h.set('Accept', 'text/csv,*/*')
  const response = await fetch(`/api/v1${path}`, { headers: h })
  if (!response.ok) {
    const detail = await response.text()
    throw new QreError(response.status, detail || response.statusText)
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
