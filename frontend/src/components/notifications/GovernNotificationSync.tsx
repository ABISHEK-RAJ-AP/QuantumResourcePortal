import { useEffect } from 'react'

import { usePermissions } from '@/auth/hooks'
import { syncGovernServerNotices } from '@/lib/governServerFeed'

const POLL_MS = 45_000

export function GovernNotificationSync() {
  const permissions = usePermissions()

  useEffect(() => {
    let cancelled = false
    const run = () => {
      if (cancelled) return
      void syncGovernServerNotices(permissions)
    }
    run()
    const timer = window.setInterval(run, POLL_MS)
    const onRefresh = () => run()
    window.addEventListener('qrp:data-refresh', onRefresh)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('qrp:data-refresh', onRefresh)
    }
  }, [permissions])

  return null
}