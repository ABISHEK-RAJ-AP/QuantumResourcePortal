import { Link } from 'react-router'
import { Users } from 'lucide-react'

import { useAuth } from '@/auth/hooks'
import { Card } from '@/components/layout/Page'
import type { WorkflowStep } from '@/components/workflow/WorkflowSteps'
import { workflowHintForRole } from '@/lib/workflow/governance'
import { cn } from '@/lib/utils'

export function WorkflowGuide({
  step,
  className,
}: {
  /** Active step from the pipeline (detail + roles come from governance metadata). */
  step: WorkflowStep | undefined
  className?: string
}) {
  const { user } = useAuth()
  const role = user?.roles?.[0]
  const hint = workflowHintForRole(role, step)
  if (!hint || !step) return null

  return (
    <Card className={cn('border-primary/15 bg-gradient-to-br from-accent/30 to-card', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">In this step</p>
          <h2 className="text-base font-semibold tracking-tight">{hint.title}</h2>
          {step.detail ? <p className="text-sm text-muted-foreground">{step.detail}</p> : null}
          <ul className="list-disc space-y-1 ps-4 text-sm text-muted-foreground">
            {hint.bullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        {step.roles && step.roles.length > 0 ? (
          <div className="flex max-w-xs flex-col gap-1 rounded-lg border border-border/80 bg-card/80 px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <Users className="size-3.5" aria-hidden />
              Typical actors
            </span>
            <ul className="text-muted-foreground">
              {step.roles.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
        {hint.links.map((link) => (
          <Link key={link.to} to={link.to} className="btn-ghost text-xs font-semibold">
            {link.label} →
          </Link>
        ))}
      </div>
    </Card>
  )
}