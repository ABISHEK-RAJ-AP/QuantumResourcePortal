import { cn } from '@/lib/utils'

function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted/80', className)}
      style={style}
      aria-hidden
    />
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 shadow-card', className)}>
      {children}
    </div>
  )
}

function Kpis({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <Bone className="mb-2 h-2.5 w-1/2" />
          <Bone className="mb-1.5 h-7 w-2/5" />
          <Bone className="h-2.5 w-3/4" />
        </Card>
      ))}
    </div>
  )
}

function TableBone({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Card className="space-y-2 p-3">
      <div className="flex gap-3 border-b border-border pb-2">
        {Array.from({ length: cols }, (_, i) => (
          <Bone key={i} className="h-2.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-3 py-1">
          {Array.from({ length: cols }, (_, c) => (
            <Bone key={c} className={cn('h-3 flex-1', c === 0 && 'max-w-[30%]')} />
          ))}
        </div>
      ))}
    </Card>
  )
}

export type BoneyardLayout =
  | 'dashboard'
  | 'table'
  | 'chart'
  | 'detail'
  | 'ops'
  | 'alerts'
  | 'grid'
  | 'list'

/** TeleScope-style page loading bones — layout matches the page shape. */
export function BoneyardSkeleton({
  layout = 'dashboard',
  className,
}: {
  layout?: BoneyardLayout
  className?: string
}) {
  const label =
    layout === 'table'
      ? 'Loading table'
      : layout === 'chart'
        ? 'Loading chart'
        : layout === 'detail'
          ? 'Loading detail'
          : 'Loading page'

  return (
    <div
      className={cn('flex w-full flex-col gap-4', className)}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {layout === 'dashboard' || layout === 'ops' ? (
        <>
          <Kpis count={layout === 'ops' ? 5 : 4} />
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <Bone className="mb-3 h-3 w-32" />
              <Bone className="h-40 w-full rounded-lg" />
            </Card>
            <Card>
              <Bone className="mb-3 h-3 w-24" />
              <Bone className="h-40 w-full rounded-lg" />
            </Card>
          </div>
          <TableBone />
        </>
      ) : null}
      {layout === 'table' || layout === 'alerts' || layout === 'list' ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Bone className="h-9 w-48 rounded-lg" />
            <Bone className="h-9 w-24 rounded-lg" />
            <Bone className="h-9 w-20 rounded-lg" />
          </div>
          {layout === 'alerts' ? <Kpis count={3} /> : null}
          <TableBone rows={layout === 'list' ? 5 : 8} />
        </>
      ) : null}
      {layout === 'chart' ? (
        <Card>
          <Bone className="mb-3 h-3 w-36" />
          <Bone className="h-52 w-full rounded-lg" />
        </Card>
      ) : null}
      {layout === 'detail' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="space-y-3 lg:col-span-2">
            <Bone className="h-4 w-40" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <Bone className="h-2.5 w-20" />
                  <Bone className="h-4 w-full" />
                </div>
              ))}
            </div>
          </Card>
          <Card className="space-y-3">
            <Bone className="h-4 w-28" />
            <Bone className="h-24 w-full rounded-lg" />
            <Bone className="h-9 w-full rounded-lg" />
          </Card>
        </div>
      ) : null}
      {layout === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i}>
              <Bone className="mb-2 h-3 w-2/3" />
              <Bone className="h-24 w-full rounded-lg" />
            </Card>
          ))}
        </div>
      ) : null}
      <span className="sr-only">{label}</span>
    </div>
  )
}
