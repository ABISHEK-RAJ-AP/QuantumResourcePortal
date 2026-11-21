import type { WorkflowStep } from '@/components/workflow/WorkflowSteps'

export const ASSET_LIFECYCLE: WorkflowStep[] = [
  { id: 'registered', label: 'Registered' },
  { id: 'active', label: 'Active' },
  { id: 'maintenance', label: 'Service' },
  { id: 'retired', label: 'Retired' },
]

export function assetLifecycleIndex(state: string) {
  if (state === 'registered') return 0
  if (state === 'active') return 1
  if (state === 'maintenance' || state === 'suspended') return 2
  if (state === 'retired') return 3
  return 0
}