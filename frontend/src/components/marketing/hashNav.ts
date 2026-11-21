import type { MouseEvent } from 'react'
import type { NavigateFunction } from 'react-router'

/** SPA-safe in-page section navigation (React Router keeps the shell mounted). */
export function scrollToLandingSection(hash: string, behavior: ScrollBehavior = 'smooth') {
  const id = hash.replace(/^#/, '')
  if (!id) return
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior, block: 'start' })
}

/** Parse `/path#section` for footer/header hash links. */
export function parsePublicHashHref(href: string): { path: string; hash: string } | null {
  const hashIndex = href.indexOf('#')
  if (hashIndex === -1) return null
  const path = href.slice(0, hashIndex) || '/'
  const hash = href.slice(hashIndex)
  return { path, hash }
}

/** Header/footer hash links: route change + scroll without full reload. */
export function followPublicHashLink(
  navigate: NavigateFunction,
  pathname: string,
  href: string,
  event: MouseEvent<HTMLAnchorElement>,
) {
  const parsed = parsePublicHashHref(href)
  if (!parsed) return
  event.preventDefault()
  const { path, hash } = parsed
  const hashId = hash.replace(/^#/, '')
  if (pathname === path) {
    void navigate({ pathname, hash: hashId }, { replace: true })
    scrollToLandingSection(hash)
    return
  }
  void navigate({ pathname: path, hash: hashId })
}

/** After landing mount, scroll to hash when DOM is ready (sticky header offset via CSS). */
export function scrollToHashWhenReady(hash: string, maxFrames = 24) {
  const id = hash.replace(/^#/, '')
  if (!id) return
  let frame = 0
  const tick = () => {
    const el = document.getElementById(id)
    if (el) {
      scrollToLandingSection(hash, 'auto')
      return
    }
    frame += 1
    if (frame < maxFrames) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}