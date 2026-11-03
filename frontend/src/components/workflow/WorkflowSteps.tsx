import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface WorkflowStep {
  id: string
  label: string
}

/**
 * Numbered 1-2-3 trail, same idea as Cert Studio registration steps:
 * done steps show a check, the active step shows its number, later steps stay muted.
 */
export function WorkflowSteps({
  steps,
  current,
  label = 'Workflow progress',
}: {
  steps: WorkflowStep[]
  /** Zero-based index of the active step. Null means the path is shown with nothing active. */
  current: number | null
  label?: string
}) {
  if (steps.length === 0) return null
  return (
    <ol className="flex flex-wrap items-center gap-y-3" aria-label={label}>
      {steps.map((step, index) => {
        const done = current != null && index < current
        const active = current != null && index === current
        return (
          <li key={step.id} className="flex min-w-0 items-center">
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ring-4 transition-colors',
                done && 'bg-success text-white ring-success-soft',
                active && 'bg-primary text-primary-foreground ring-accent',
                !done && !active && 'bg-muted text-muted-foreground ring-transparent',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
            </span>
            <span
              className={cn(
                'ms-2.5 truncate text-sm',
                active ? 'font-semibold text-foreground' : done ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'mx-3 hidden h-0.5 w-10 rounded-full sm:block',
                  done ? 'bg-success' : 'bg-border',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
