import { apiGet, apiRequest } from '@/api/client'

/** GET /healthz — liveness (LLD §13.6). */
export interface Liveness {
  status: 'ok'
  version: string
  time: string
}

export interface Check {
  ok: boolean
  detail: string
}

/** GET /readyz — readiness; 200 when ready, 503 with the same body when not. */
export interface Readiness {
  status: 'ready' | 'not_ready'
  version: string
  environment: string
  time: string
  checks: Record<string, Check>
}

export const systemKeys = {
  liveness: ['system', 'liveness'] as const,
  readiness: ['system', 'readiness'] as const,
}

export function fetchLiveness(): Promise<Liveness> {
  return apiGet<Liveness>('/healthz')
}

export async function fetchReadiness(): Promise<Readiness> {
  const response = await apiRequest<Readiness>('/readyz', { acceptStatuses: [503] })
  return response.data
}
