import { cva, type VariantProps } from 'class-variance-authority'
import { AlertTriangle, CheckCircle2, CircleDashed, Info, XCircle, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Status: icon + text + colour (never colour alone). Natural case — no shouty ALL CAPS.
 */
const badge = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium',
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
      <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
      {label}
    </span>
  )
}
