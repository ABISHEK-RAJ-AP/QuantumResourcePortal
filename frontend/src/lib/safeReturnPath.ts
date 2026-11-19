/** Post-auth navigation target — blocks open redirects (`//evil`, `/\\evil`, protocol-relative). */
export function safeReturnPath(raw: string | undefined | null, fallback = '/qrp'): string {
  if (!raw || typeof raw !== 'string') return fallback
  const path = raw.trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return fallback
  if (/^\/[^/]*:/i.test(path)) return fallback
  return path
}