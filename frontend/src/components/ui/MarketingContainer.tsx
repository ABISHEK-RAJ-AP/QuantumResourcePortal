import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/utils'

const LANDING_GUTTER = 'clamp(24px, 4vw, 56px)'

export function MarketingContainer({
  children,
  narrow = false,
  className,
  style,
}: {
  children: ReactNode
  narrow?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={cn('qre-marketing-container', narrow && 'qre-marketing-container--narrow', className)}
      style={{
        width: '100%',
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: LANDING_GUTTER,
        paddingRight: LANDING_GUTTER,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  )
}