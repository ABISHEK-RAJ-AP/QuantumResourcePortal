/**
 * Shared chart tokens for Recharts (QRP):
 * one series palette, semantic status colours, tooltip/axis ink that follow light/dark.
 */

export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

/** Status / severity fills from QRP CSS tokens (read at call time). */
export function getChartSemanticColors() {
  if (typeof document === 'undefined') {
    return {
      healthy: '#16a36a',
      critical: '#e05252',
      warn: '#e9a23b',
      info: '#20b8d5',
      unknown: '#5f6e86',
      accent: '#4a63f0',
    }
  }
  const root = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => root.getPropertyValue(name).trim() || fallback
  return {
    healthy: v('--success', '#16a36a'),
    critical: v('--critical', '#e05252'),
    warn: v('--warning', '#e9a23b'),
    info: v('--info', '#20b8d5'),
    unknown: v('--muted-foreground', '#5f6e86'),
    accent: v('--primary', '#4a63f0'),
  }
}

export function getJobStatusChartColors() {
  const sem = getChartSemanticColors()
  return {
    COMPLETED: sem.healthy,
    FAILED: sem.critical,
    CANCELLED: sem.warn,
    RUNNING: sem.accent,
    QUEUED: sem.unknown,
  }
}

export function getSeverityChartColors() {
  const sem = getChartSemanticColors()
  return { CRITICAL: sem.critical, WARNING: sem.warn, INFO: sem.info }
}

function isDarkDocument() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
}

/** Recharts Tooltip contentStyle / labelStyle for both themes. */
export function rechartsTooltipStyles() {
  const dark = isDarkDocument()
  return {
    contentStyle: {
      background: dark ? 'var(--card)' : 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      color: 'var(--foreground)',
      fontSize: 12,
      lineHeight: 1.45,
      maxWidth: 320,
    },
    labelStyle: { color: 'var(--foreground)', fontWeight: 600 },
    itemStyle: { color: 'var(--muted-foreground)' },
  }
}

export function rechartsAxisTick(fontSize = 11) {
  return { fontSize, fill: 'var(--muted-foreground)' }
}

/** Attach a stable fill from the shared series ladder. */
export function withChartFills<T extends { name: string; value: number }>(rows: T[]) {
  return rows.map((row, i) => ({ ...row, fill: chartColor(i) }))
}
