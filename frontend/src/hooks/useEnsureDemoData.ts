import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { asList, qre } from '@/api/qre'
import { seedPortalDemo } from '@/api/seedDemo'
import { useAuth } from '@/auth/hooks'
import { demoActionsAllowed } from '@/lib/demo'

const SESSION_KEY = 'qrp_demo_ensure_ran'

/**
 * Lab: if workspace APIs return an empty tenant, load interconnected PostgreSQL demo once per browser session.
 * Backend also auto-seeds on API start when QRE_AUTO_SEED_DEMO=true (default in lab).
 */
export function useEnsureDemoData() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const started = useRef(false)

  useEffect(() => {
    if (!demoActionsAllowed || started.current) return
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1') return
    const isAdmin = (user?.roles ?? []).some((r) => String(r).toUpperCase().includes('ADMIN'))
    if (!isAdmin) return

    started.current = true
    void (async () => {
      try {
        const projects = asList(await qre<unknown>('/projects'))
        const summary = await qre<{ queue?: number }>('/governance/summary')
        const inventory = asList(await qre<unknown>('/inventory/assets'))
        const empty =
          projects.length === 0 && inventory.length === 0 && Number(summary.queue ?? 0) === 0
        if (!empty) return
        await seedPortalDemo()
        sessionStorage.setItem(SESSION_KEY, '1')
        await queryClient.invalidateQueries()
      } catch {
        /* API down or not authorised yet */
      }
    })()
  }, [user, queryClient])
}