import { cva, type VariantProps } from 'class-variance-authority'
import { AlertTriangle, CheckCircle2, CircleDashed, Info, XCircle, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Status indicator that never relies on colour alone: icon + text + colour (REQ-004, REQ-N031).
 * Text is uppercase by convention (e.g. ACTIVE, DEGRADED) and always readable by screen readers.
 */
const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase whitespace-nowrap',
  {
    variants: {
      tone: {
        success: 'bg-success-soft text-success-text',
        warning: 'bg-warning-soft text-warning-text',
        critical: 'bg-critical-soft text-critical-text',
        info: 'bg-info-soft text-info-text',
        neutral: 'bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

const ICONS: Record<NonNullable<VariantProps<typeof badge>['tone']>, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
  info: Info,
  neutral: CircleDashed,
}

export type StatusTone = keyof typeof ICONS

export interface StatusBadgeProps extends VariantProps<typeof badge> {
  label: string
  className?: string
}

export function StatusBadge({ label, tone = 'neutral', className }: StatusBadgeProps) {
  const Icon = ICONS[tone ?? 'neutral']
  return (
    <span className={cn(badge({ tone }), className)}>
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      {label}
    </span>
  )
}
