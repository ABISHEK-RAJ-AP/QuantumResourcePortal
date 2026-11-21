import type { WorkflowStep } from '@/components/workflow/WorkflowSteps'
import {
  enrichWorkflowSteps,
  GOVERNANCE_LIFECYCLE,
} from '@/lib/workflow/governance'

export type ApprovalRow = Record<string, unknown>

export const APPROVAL_PATH: WorkflowStep[] = GOVERNANCE_LIFECYCLE.slice(0, 3)

/** Server query presets — maps to GET /approvals?state=&scope= */
export const APPROVAL_FILTERS = [
  { id: 'queue', label: 'Needs review' },
  { id: 'mine', label: 'My requests' },
  { id: 'submitted_for_review', label: 'Submitted' },
  { id: 'in_review', label: 'In review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'withdrawn', label: 'Withdrawn' },
] as const

export function approvalsPath(filter: string, projectId?: string) {
  const params = new URLSearchParams()
  if (projectId) params.set('project_id', projectId)
  if (filter === 'mine') params.set('scope', 'mine')
  else if (filter !== 'queue') params.set('state', filter)
  const q = params.toString()
  return q ? `/approvals?${q}` : '/approvals'
}

export function progressSteps(row: ApprovalRow): { steps: WorkflowStep[]; index: number } {
  const progress = (row.governance_progress as ApprovalRow | undefined) ?? {}
  const stages = Array.isArray(progress.stages) ? (progress.stages as ApprovalRow[]) : []
  const steps: WorkflowStep[] =
    stages.length > 0
      ? stages.map((stage, i) => ({
          id: String(stage.id || i),
          label: String(stage.label || `Stage ${i + 1}`),
        }))
      : APPROVAL_PATH
  const index = Number(progress.stage_index ?? 0)
  const state = String(row.governance_state || '')
  if (state === 'approved') return { steps: enrichWorkflowSteps(steps), index: steps.length }
  return { steps: enrichWorkflowSteps(steps), index: Number.isFinite(index) ? index : 0 }
}

export function approvalAgeLabel(row: ApprovalRow): string {
  const raw = row.created_at ?? row.updated_at
  if (!raw) return '—'
  const then = Date.parse(String(raw))
  if (Number.isNaN(then)) return String(raw)
  const hours = Math.max(0, Math.floor((Date.now() - then) / 3_600_000))
  if (hours < 1) return '<1h'
  if (hours < 48) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}
