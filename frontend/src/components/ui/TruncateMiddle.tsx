import { cn } from '@/lib/utils'

/** Ellipsis on the start segment; tail (IDs, extensions) stays readable. */
export function TruncateMiddle({
  text,
  tail = 12,
  className,
  title,
}: {
  text: string
  tail?: number
  className?: string
  title?: string
}) {
  const t = Math.max(4, Math.min(tail, text.length - 1))
  const showSplit = text.length > t + 4
  const lead = showSplit ? text.slice(0, text.length - t) : text
  const end = showSplit ? text.slice(-t) : ''

  return (
    <span className={cn('truncate-mid font-mono text-xs', className)} title={title ?? text}>
      <span className="truncate-mid__lead">{lead}</span>
      {showSplit ? (
        <>
          <span className="truncate-mid__sep" aria-hidden>
            …
          </span>
          <span className="truncate-mid__tail">{end}</span>
        </>
      ) : null}
    </span>
  )
}