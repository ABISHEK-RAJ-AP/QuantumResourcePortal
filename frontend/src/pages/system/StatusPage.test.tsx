import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { StatusPage } from '@/pages/system/StatusPage'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <StatusPage />
    </QueryClientProvider>,
  )
}

function mockApi(readyStatus: 200 | 503) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.endsWith('/healthz')) {
      return Response.json({ status: 'ok', version: '0.1.0', time: '2026-11-02T07:00:00Z' })
    }
    return Response.json(
      {
        status: readyStatus === 200 ? 'ready' : 'not_ready',
        version: '0.1.0',
        environment: 'lab',
        time: '2026-11-02T07:00:00Z',
        checks: {
          configuration: { ok: true, detail: 'valid' },
          database: { ok: true, detail: 'reachable' },
          migrations: readyStatus === 200
            ? { ok: true, detail: 'at head 0001' }
            : { ok: false, detail: 'database at none, code head 0001' },
        },
      },
      { status: readyStatus },
    )
  })
}

describe('StatusPage', () => {
  it('shows a ready platform with text labels, not colour alone', async () => {
    mockApi(200)
    renderPage()
    expect(await screen.findByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('Alive')).toBeInTheDocument()
    expect(screen.getByText('at head 0001')).toBeInTheDocument()
    expect(screen.getAllByText('OK')).toHaveLength(3)
  })

  it('shows failing checks when the API reports not ready', async () => {
    mockApi(503)
    renderPage()
    expect(await screen.findByText('Not ready')).toBeInTheDocument()
    expect(screen.getByText('Failing')).toBeInTheDocument()
  })

  it('explains how to recover when the API is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    renderPage()
    expect(await screen.findByText('Unreachable')).toBeInTheDocument()
    expect(screen.getByText('make dev-api')).toBeInTheDocument()
  })
})
