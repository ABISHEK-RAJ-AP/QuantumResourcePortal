import type { ReactNode } from 'react'

import { PublicFooter } from '@/components/marketing/PublicFooter'
import { PublicHeader } from '@/components/marketing/PublicHeader'
import { A11yPreheader } from '@/components/shell/A11yPreheader'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

export function PublicShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  return (
    <div
      className={cn(
        'relative flex min-h-svh flex-col',
        dark ? 'bg-[#0b1220] text-white' : 'bg-surface text-foreground',
        className,
      )}
    >
      <A11yPreheader />
      <PublicHeader />
      <div id="page-content" className="flex min-h-0 flex-1 flex-col" tabIndex={-1}>
        {children}
      </div>
      <PublicFooter variant={dark ? 'dark' : 'light'} />
    </div>
  )
}
