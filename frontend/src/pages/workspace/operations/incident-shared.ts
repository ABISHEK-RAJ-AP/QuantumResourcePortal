import type { WorkflowStep } from '@/components/workflow/WorkflowSteps'

export const INCIDENT_FLOW: WorkflowStep[] = [
  { id: 'OPEN', label: 'Detected' },
  { id: 'ACKNOWLEDGED', label: 'Triaged' },
  { id: 'INVESTIGATING', label: 'Investigating' },
  { id: 'RESOLVED', label: 'Resolved' },
]

export function incidentStepIndex(status: string) {
  const s = status.toUpperCase()
  if (s === 'RESOLVED' || s === 'CLOSED') return 3
  if (s === 'INVESTIGATING' || s === 'MITIGATING') return 2
  if (s === 'ACKNOWLEDGED' || s === 'ASSIGNED') return 1
  return 0
}
