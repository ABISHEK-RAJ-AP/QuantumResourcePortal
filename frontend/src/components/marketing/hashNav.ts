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