import { describe, expect, it, vi } from 'vitest'

import { ApiError, apiGet, apiRequest, CLIENT_ERROR_CODES } from '@/api/client'

function jsonResponse(body: unknown, status: number, contentType = 'application/json') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': contentType, 'X-Correlation-ID': '01JD3Q7A0B1C2D3E4F5G6H7J8K' },
  })
}

describe('apiRequest', () => {
  it('returns the body and correlation id on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ status: 'ok' }, 200))
    const result = await apiRequest<{ status: string }>('/healthz')
    expect(result.data.status).toBe('ok')
    expect(result.correlationId).toBe('01JD3Q7A0B1C2D3E4F5G6H7J8K')
  })

  it('turns problem+json into ApiError with code, detail and field errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          code: 'VALIDATION_FAILED',
          title: 'One or more fields are invalid. See field_errors.',
          status: 400,
          detail: 'One or more fields are invalid. See field_errors.',
          correlation_id: 'abc-123-correlation',
          field_errors: [{ field: 'shots', code: 'GREATER_THAN', message: 'must be > 0' }],
        },
        400,
        'application/problem+json',
      ),
    )
    const error = await apiGet('/api/v1/workloads').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.code).toBe('VALIDATION_FAILED')
    expect(apiError.status).toBe(400)
    expect(apiError.correlationId).toBe('abc-123-correlation')
    expect(apiError.fieldErrors[0].field).toBe('shots')
  })

  it('accepts listed non-2xx statuses (readiness 503)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ status: 'not_ready' }, 503))
    const result = await apiRequest<{ status: string }>('/readyz', { acceptStatuses: [503] })
    expect(result.status).toBe(503)
    expect(result.data.status).toBe('not_ready')
  })

  it('reports network failures as a client-side NETWORK_ERROR', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const error = (await apiGet('/healthz').catch((e: unknown) => e)) as ApiError
    expect(error.code).toBe(CLIENT_ERROR_CODES.network)
    expect(error.status).toBe(0)
  })

  it('sends same-origin credentials and JSON bodies', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    await apiRequest('/api/v1/thing', { method: 'POST', json: { a: 1 } })
    const [, init] = spy.mock.calls[0]
    expect(init?.credentials).toBe('same-origin')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
    expect(init?.body).toBe('{"a":1}')
  })
})
