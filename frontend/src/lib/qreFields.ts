type Row = Record<string, unknown>

export function policyVersion(row: Row | undefined | null): string {
  if (!row) return '—'
  const raw = row.schema_version ?? row.policy_version ?? row.version
  if (raw == null || raw === '') return '—'
  return String(raw)
}

export function policyDisplayName(row: Row | undefined | null): string {
  if (!row) return '—'
  const name = row.name
  if (name != null && String(name).trim()) return String(name)
  const id = row.policy_id
  if (id != null && String(id).trim()) return String(id)
  return '—'
}

export function stagePermission(stage: Row): string {
  const p = stage.required_permission ?? stage.permission
  if (p == null || p === '') return '—'
  return String(p)
}