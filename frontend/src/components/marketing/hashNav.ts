/** SPA-safe in-page section navigation (React Router keeps the shell mounted). */
export function scrollToLandingSection(hash: string, behavior: ScrollBehavior = 'smooth') {
  const id = hash.replace(/^#/, '')
  if (!id) return
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior, block: 'start' })
}