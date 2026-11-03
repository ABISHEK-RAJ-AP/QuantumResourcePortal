import { useState } from 'react'

import { cn } from '@/lib/utils'

/** Compact mono ID with one-click copy. */
export function CopyableId({
  value,
  keep = 12,
  className,
}: {
  value: string
  keep?: number
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  if (!value) return <span className="text-muted-foreground">—</span>
  const shown = value.length > keep + 1 ? `${value.slice(0, keep)}…` : value
  return (
    <button
      type="button"
      title={copied ? 'Copied' : `Copy ${value}`}
      className={cn(
        'font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        })
      }}
    >
      {copied ? 'Copied' : shown}
    </button>
  )
}
