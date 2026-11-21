import type { MouseEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { parsePublicHashHref, scrollToLandingSection } from '@/components/marketing/hashNav'

export function PublicHashLink({
  href,
  className,
  children,
  onAfterNav,
}: {
  href: string
  className?: string
  children: ReactNode
  onAfterNav?: () => void
}) {
  const navigate = useNavigate()
  const parsed = parsePublicHashHref(href)

  if (!parsed) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  }

  const { path, hash } = parsed
  const hashId = hash.replace(/^#/, '')

  // Auth/legal → landing: native full navigation (reliable; SPA hash from other routes can desync).
  if (typeof window !== 'undefined' && window.location.pathname !== path) {
    return (
      <a href={href} className={className} onClick={() => onAfterNav?.()}>
        {children}
      </a>
    )
  }

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    void navigate({ pathname: path, hash: hashId }, { replace: true })
    scrollToLandingSection(hash)
    onAfterNav?.()
  }

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  )
}