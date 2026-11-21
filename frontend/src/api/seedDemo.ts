import { asList, qre } from '@/api/qre'

export type SeedDemoResult = {
  projects: number
  approvals: number
  reservations: number
  pools: number
  assets: number
  members: number
  errors: string[]
  source?: 'backend' | 'client-fallback'
}

type BackendSeedPayload = {
  created?: boolean
  counts?: Record<string, number>
  demo_users?: string[]
}

/**
 * Prefer backend PostgreSQL seed (interconnected demo). Falls back to legacy API chaining when
 * the lab-only admin route is unavailable.
 */
export async function seedPortalDemo(opts?: { force?: boolean }): Promise<SeedDemoResult> {
  const errors: string[] = []
  try {
    const res = await qre<BackendSeedPayload>('/admin/seed-demo', {
      method: 'POST',
      body: JSON.stringify({ force: Boolean(opts?.force) }),
    })
    const counts = res.counts ?? {}
    return {
      projects: counts.projects ?? 0,
      approvals: counts.workloads ?? 0,
      reservations: counts.reservations ?? 0,
      pools: 0,
      assets: 0,
      members: res.demo_users?.length ?? 0,
      errors,
      source: 'backend',
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'backend seed unavailable')
  }
  return { ...(await seedPortalDemoClient()), errors, source: 'client-fallback' }
}

/** Legacy per-API seed — supplements missing slices only when backend seed is blocked. */
export async function seedPortalDemoClient(): Promise<SeedDemoResult> {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const errors: string[] = []
  let projects = 0
  let approvals = 0
  let reservations = 0
  let pools = 0
  let assets = 0
  let members = 0

  const projectSpecs = [
    { name: `Demo Lab ${stamp}`, description: 'Materials simulation lab — seeded for UI walkthrough', project_type: 'quantum_circuit' },
    { name: `Demo Ops ${stamp}`, description: 'Operations rehearsal project', project_type: 'quantum_circuit' },
  ]

  const projectIds: string[] = []
  for (const spec of projectSpecs) {
    try {
      const row = await qre<Record<string, unknown>>('/projects', {
        method: 'POST',
        body: JSON.stringify(spec),
      })
      if (row.project_id) {
        projectIds.push(String(row.project_id))
        projects += 1
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'project create failed')
    }
  }

  if (projectIds.length === 0) {
    try {
      const listed = asList(await qre<unknown>('/projects'))
      for (const row of listed.slice(0, 4)) {
        if (row.project_id) projectIds.push(String(row.project_id))
      }
    } catch {
      /* ignore */
    }
  }

  for (const projectId of projectIds.slice(0, 2)) {
    for (const [username, role] of [
      ['demo_researcher', 'editor'],
      ['demo_pi', 'editor'],
    ] as const) {
      try {
        await qre(`/projects/${encodeURIComponent(projectId)}/members`, {
          method: 'POST',
          body: JSON.stringify({ username, role }),
        })
        members += 1
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'member seed failed')
      }
    }
  }

  for (const projectId of projectIds) {
    try {
      const draft = await qre<Record<string, unknown>>('/workload-submissions', {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          metadata: { purpose: `Seeded demo request ${stamp}`, shots: 100 },
        }),
      })
      await qre(`/workload-submissions/${encodeURIComponent(String(draft.submission_id))}/submit-for-review`, {
        method: 'POST',
      })
      approvals += 1
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'approval seed failed')
    }
  }

  return { projects, approvals, reservations, pools, assets, members, errors }
}