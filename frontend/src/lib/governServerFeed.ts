import { qre } from '@/api/qre'
import { asList } from '@/api/qre'
import {
  reconcileGovernServerNotices,
  removeGovernNotice,
  upsertGovernNotice,
} from '@/lib/governNotices'

type Summary = { queue?: number }
type ApprovalRow = {
  workload_id?: string
  governance_state?: string
  project_id?: string
  governance_progress?: { label?: string }
}

function can(permissions: Set<string>, perm: string) {
  return permissions.has(perm)
}

function reviewPath(workloadId: string) {
  return `/qrp/approvals/${encodeURIComponent(workloadId)}`
}

/** Upsert server-driven notices; prune stale `govern:server:*` ids. */
export async function syncGovernServerNotices(permissions: Set<string>) {
  if (!can(permissions, 'approvals:read')) {
    reconcileGovernServerNotices(new Set())
    return
  }

  const keep = new Set<string>()

  try {
    const summary = await qre<Summary>('/governance/summary')
    const queue = Number(summary.queue) || 0
    const queueId = 'govern:server:queue'
    if (queue > 0) {
      keep.add(queueId)
      upsertGovernNotice({
        id: queueId,
        source: 'server',
        app: 'QRP',
        title: 'Review queue',
        body: `${queue} workload${queue === 1 ? '' : 's'} in the governance queue.`,
        variant: queue >= 8 ? 'warn' : 'info',
        actions: [{ label: 'Open queue', href: '/qrp/approvals' }],
      })
    } else {
      removeGovernNotice(queueId)
    }
  } catch {
    /* offline */
  }

  if (can(permissions, 'approvals:decide')) {
    try {
      const pending = await qre<{ items?: ApprovalRow[] }>('/approvals?state=submitted_for_review')
      for (const row of (pending.items || []).slice(0, 12)) {
        const wid = row.workload_id
        if (!wid) continue
        const id = `govern:server:approval:${wid}`
        keep.add(id)
        const prog = row.governance_progress?.label || row.governance_state || 'Review'
        upsertGovernNotice({
          id,
          source: 'server',
          app: 'QRP',
          title: 'Approval requested',
          body: `${wid} · ${prog}${row.project_id ? ` · ${row.project_id}` : ''}`,
          variant: 'info',
          actions: [{ label: 'Review', href: reviewPath(wid) }],
        })
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const inReview = await qre<unknown>('/approvals?state=in_review')
    for (const row of asList(inReview).slice(0, 8) as ApprovalRow[]) {
      const wid = row.workload_id
      if (!wid) continue
      const id = `govern:server:in_review:${wid}`
      keep.add(id)
      upsertGovernNotice({
        id,
        source: 'server',
        app: 'QRP',
        title: 'In review',
        body: `${wid} is in active review.`,
        variant: 'info',
        actions: [{ label: 'Open', href: reviewPath(wid) }],
      })
    }
  } catch {
    /* ignore */
  }

  reconcileGovernServerNotices(keep)
}