import { Link } from 'react-router'
import { Users } from 'lucide-react'

import { useAuth } from '@/auth/hooks'
import type { WorkflowStep } from '@/components/workflow/WorkflowSteps'
import { workflowHintForRole } from '@/lib/workflow/governance'
import { cn } from '@/lib/utils'

export function WorkflowGuide({
  step,
  className,
}: {
  step: WorkflowStep | undefined
  className?: string
}) {
  const { user } = useAuth()
  const role = user?.roles?.[0]
  const hint = workflowHintForRole(role, step)
  if (!hint || !step) return null

  const bullets = hint.bullets.slice(0, 3)

  return (
    <details
      open
      className={cn(
        'rounded-xl border border-border/80 bg-card px-3 py-2 shadow-card',
        className,
      )}
    >
      <summary className="cursor-pointer list-none text-sm font-semibold tracking-tight text-foreground [&::-webkit-details-marker]:hidden">
        <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Step guide
        </span>
        <span className="ms-2">{hint.title}</span>
      </summary>
      <div className="mt-2 grid gap-2 border-t border-border/60 pt-2 lg:grid-cols-[1fr_minmax(10rem,14rem)]">
        <div className="min-w-0 space-y-1.5 text-sm text-muted-foreground">
          {step.detail ? <p className="text-foreground/90">{step.detail}</p> : null}
          <ul className="list-disc space-y-0.5 ps-4">
            {bullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        {step.roles && step.roles.length > 0 ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Users className="size-3.5" aria-hidden />
              Typical roles
            </span>
            <p className="mt-1 text-muted-foreground">{step.roles.join(' · ')}</p>
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {hint.links.slice(0, 5).map((link) => (
          <Link key={link.to} to={link.to} className="text-xs font-semibold text-primary hover:underline">
            {link.label}
          </Link>
        ))}
      </div>
    </details>
  )
}