import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function NotifyItemGroup({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div role="list" className={cn('qre-notify-item-group', className)} {...props}>
      {children}
    </div>
  )
}

type NotifyItemProps = {
  tone?: 'ok' | 'err' | 'warn'
  app?: string
  title?: string
  description?: string
  time?: string
  unread?: boolean
  footer?: ReactNode
  source?: string
  className?: string
  onDismiss?: () => void
}

export function NotifyItem({
  tone = 'ok',
  app,
  title,
  description,
  time,
  unread,
  footer,
  source,
  onDismiss,
  className,
}: NotifyItemProps) {
  return (
    <article
      role="listitem"
      className={cn('qre-notify-item', `qre-notify-item--${tone}`, className)}
      data-tone={tone}
      data-source={source || undefined}
    >
      <div className="qre-notify-item__media" aria-hidden>
        <span className={cn('qre-notify-item__dot', `qre-notify-item__dot--${tone}`)} />
      </div>
      <div className="qre-notify-item__content">
        <div className="qre-notify-item__meta">
          <span className="qre-notify-item__app">{app}</span>
          {time ? <time className="qre-notify-item__time">{time}</time> : null}
          {unread ? <span className="qre-notify-item__unread" aria-label="Unread" /> : null}
        </div>
        {title ? <h4 className="qre-notify-item__title">{title}</h4> : null}
        {description ? <p className="qre-notify-item__desc">{description}</p> : null}
        {footer ? <div className="qre-notify-item__foot">{footer}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" className="qre-notify-item__dismiss" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      ) : null}
    </article>
  )
}