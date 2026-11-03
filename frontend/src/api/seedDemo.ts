import { asList, qre } from '@/api/qre'

export type SeedDemoResult = {
  projects: number
  approvals: number
  reservations: number
  pools: number
  assets: number
  errors: string[]
}

/**
 * Populate a demo workspace via real APIs so list pages look lived-in.
 * Idempotent-ish: creates new labeled demo rows each run; safe for local demos.
 */
export async function seedPortalDemo(): Promise<SeedDemoResult> {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const errors: string[] = []
  let projects = 0
  let approvals = 0
  let reservations = 0
  let pools = 0
  let assets = 0

  const projectIds: string[] = []
  for (const name of [`Demo Lab ${stamp}`, `Demo Ops ${stamp}`, `Demo Research ${stamp}`]) {
    try {
      const row = await qre<Record<string, unknown>>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: 'Seeded demo project for portal UI walkthrough',
          project_type: 'quantum_circuit',
        }),
      })
      if (row.project_id) {
        projectIds.push(String(row.project_id))
        projects += 1
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'project create failed')
    }
  }

  // Prefer existing project if create failed
  if (projectIds.length === 0) {
    try {
      const listed = asList(await qre<unknown>('/projects'))
      for (const row of listed.slice(0, 2)) {
        if (row.project_id) projectIds.push(String(row.project_id))
      }
    } catch {
      /* ignore */
    }
  }

  for (const projectId of projectIds.slice(0, 3)) {
    try {
      const draft = await qre<Record<string, unknown>>('/workload-submissions', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId }),
      })
      await qre(`/workload-submissions/${encodeURIComponent(String(draft.submission_id))}/submit-for-review`, {
        method: 'POST',
      })
      approvals += 1
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'approval seed failed')
    }
  }

  let poolId = ''
  try {
    const pool = await qre<Record<string, unknown>>('/virtual-pools', {
      method: 'POST',
      body: JSON.stringify({ name: `Demo pool ${stamp}` }),
    })
    if (pool.pool_id) {
      pools += 1
      poolId = String(pool.pool_id)
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'pool create failed')
  }

  const now = Date.now()
  // Spread across several local days so the month-grid calendar looks populated.
  const dayOffsets = [0, 1, 2, 5, 8]
  for (let i = 0; i < dayOffsets.length; i++) {
    try {
      const dayStart = new Date(now)
      dayStart.setHours(10, 0, 0, 0)
      dayStart.setDate(dayStart.getDate() + dayOffsets[i])
      const dayEnd = new Date(dayStart.getTime() + 2 * 3600_000)
      await qre('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          resource_ref: `demo-backend-${(i % 3) + 1}`,
          project_id: projectIds[i % Math.max(projectIds.length, 1)] || projectIds[0] || null,
          window_start: dayStart.toISOString(),
          window_end: dayEnd.toISOString(),
          purpose: `Demo reservation hold ${stamp} #${i + 1}`,
        }),
      })
      reservations += 1
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'reservation create failed')
    }
  }

  const assetIds: string[] = []
  for (const [cls, exec] of [
    ['QPU', 'hardware'],
    ['Simulator', 'simulated'],
  ] as const) {
    try {
      const asset = await qre<Record<string, unknown>>('/inventory/assets', {
        method: 'POST',
        body: JSON.stringify({
          asset_class: cls,
          execution_class: exec,
          provider_id: 'cdac_quantum',
          native_asset_id: `demo-${exec}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
        }),
      })
      assets += 1
      if (asset.asset_id) assetIds.push(String(asset.asset_id))
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'asset create failed')
    }
  }

  if (poolId && assetIds[0]) {
    try {
      await qre(`/virtual-pools/${encodeURIComponent(poolId)}/members`, {
        method: 'POST',
        body: JSON.stringify({ asset_id: assetIds[0] }),
      })
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'pool member failed')
    }
  }

  return { projects, approvals, reservations, pools, assets, errors }
}
