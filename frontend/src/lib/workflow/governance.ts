import type { WorkflowStep } from '@/components/workflow/WorkflowSteps'

/** Portal-wide governance trail (queue pages show full path; detail aligns to policy stages). */
export const GOVERNANCE_LIFECYCLE: WorkflowStep[] = [
  {
    id: 'submit',
    label: 'Submit',
    detail: 'Package the workload and open review from a project.',
    roles: ['Researcher', 'Project owner', 'Analyst'],
  },
  {
    id: 'review',
    label: 'Review',
    detail: 'Policy stages, quota check, stage permissions.',
    roles: ['Technical reviewer', 'Policy reviewer', 'Approver'],
  },
  {
    id: 'authorise',
    label: 'Authorise',
    detail: 'Final approve or reject; decision is written to the audit trail.',
    roles: ['Approver', 'Quantum ops', 'Admin'],
  },
  {
    id: 'hold',
    label: 'Schedule hold',
    detail: 'Request a reservation window on an asset or backend.',
    roles: ['Scheduler', 'Quantum ops', 'Project owner'],
  },
  {
    id: 'dispatch',
    label: 'Dispatch',
    detail: 'Authorize provider attempts and reconcile outcomes (G3).',
    roles: ['Quantum ops', 'Operator'],
  },
  {
    id: 'evidence',
    label: 'Evidence',
    detail: 'Snapshots, metering, and append-only audit for auditors.',
    roles: ['Auditor', 'Security', 'Admin'],
  },
]

const META_BY_ID = Object.fromEntries(GOVERNANCE_LIFECYCLE.map((s) => [s.id, s])) as Record<string, WorkflowStep>

const STATE_STEP_INDEX: Record<string, number> = {
  draft: 0,
  submitted_for_review: 1,
  in_review: 1,
  changes_requested: 1,
  approved: 2,
  rejected: 2,
  withdrawn: 0,
}

export function governanceStepIndexForState(state: string | undefined): number {
  if (!state) return 0
  return STATE_STEP_INDEX[state] ?? 1
}

/** Merge API stage labels with static role/detail copy when ids match. */
export function enrichWorkflowSteps(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.map((step) => {
    const meta = META_BY_ID[step.id]
    if (!meta) return step
    return {
      ...step,
      detail: step.detail ?? meta.detail,
      roles: step.roles ?? meta.roles,
    }
  })
}

export type WorkflowHint = {
  title: string
  bullets: string[]
  links: { label: string; to: string }[]
}

/** Role-aware copy for the active pipeline step (best-effort string match on role codes). */
export function workflowHintForRole(role: string | undefined, step: WorkflowStep | undefined): WorkflowHint | null {
  if (!step) return null
  const r = (role || 'operator').toLowerCase()
  const baseLinks: { label: string; to: string }[] = [
    { label: 'Review queue', to: '/qrp/approvals' },
    { label: 'Quotas', to: '/qrp/quotas' },
    { label: 'Audit trail', to: '/qrp/audit' },
  ]
  switch (step.id) {
    case 'submit':
      return {
        title: r.includes('research') || r.includes('analyst') ? 'Your move: submit' : 'Requester stage',
        bullets: [
          'Create or pick a project, then submit a workload package for review.',
          'Ensure package SHA and project membership are current before submit.',
          'After submit, track state in the review queue — do not dispatch until approved.',
        ],
        links: [{ label: 'Projects', to: '/qrp/projects' }, ...baseLinks],
      }
    case 'review':
      return {
        title: r.includes('auditor') ? 'Read-only review' : 'Stage review',
        bullets: [
          'Confirm required permission on the current stage before deciding.',
          'Check quota evaluation — over cap blocks approve until policy allows.',
          'Use Request changes when the package needs fixes; Reject closes the trail.',
        ],
        links: [{ label: 'Policies', to: '/qrp/policies' }, ...baseLinks],
      }
    case 'authorise':
      return {
        title: 'Authorisation',
        bullets: [
          'Approve only when quota and policy gates pass.',
          'Rationale text is stored on the audit trail — required for reject and changes.',
          'Approved workloads should move to schedule hold, not direct dispatch.',
        ],
        links: [{ label: 'Reservations', to: '/qrp/reservations' }, { label: 'Scheduling', to: '/qrp/scheduling' }, ...baseLinks],
      }
    case 'hold':
      return {
        title: 'Capacity hold',
        bullets: [
          'Holds plan governance windows; they are not provider bookings.',
          'Pick asset/backend ref, window, and purpose; overlaps may conflict in calendar.',
          'Link holds to an approved project when capacity is project-scoped.',
        ],
        links: [{ label: 'Scheduling', to: '/qrp/scheduling' }, { label: 'Inventory', to: '/qrp/inventory' }],
      }
    case 'dispatch':
      return {
        title: 'Operations dispatch',
        bullets: [
          'Reconcile authorise attempts and provider outcomes on the G3 ledger.',
          'Ops roles monitor queues, incidents, and backend health before dispatch.',
        ],
        links: [{ label: 'Reconciliation', to: '/qrp/reconciliation' }, { label: 'Jobs', to: '/qrp/jobs' }],
      }
    case 'evidence':
      return {
        title: 'Evidence & audit',
        bullets: [
          'Export audit events and evidence snapshots for compliance review.',
          'Auditors: filter by actor, action, and target — missing rows are not zero usage.',
        ],
        links: [{ label: 'Audit', to: '/qrp/audit' }, { label: 'Metering', to: '/qrp/quotas' }],
      }
    default:
      return {
        title: step.label,
        bullets: [step.detail || 'Follow the stage trail in the header; open related hubs from the dock.'],
        links: baseLinks,
      }
  }
}