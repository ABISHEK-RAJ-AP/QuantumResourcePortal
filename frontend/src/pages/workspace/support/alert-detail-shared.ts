export type AlertRow = Record<string, unknown>

export function formatAlertAge(iso: unknown) {
  const t = new Date(String(iso || '')).getTime()
  if (!Number.isFinite(t)) return '—'
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export function alertMetricUnit(alertType: string) {
  const t = alertType.toUpperCase()
  if (t.includes('T1') || t.includes('T2')) return 'µs'
  if (t.includes('READOUT') || t.includes('ERROR') || t.includes('FIDELITY')) return ''
  return ''
}

export function explainAlert(row: AlertRow, current: number, threshold: number) {
  const type = String(row.alert_type || '')
  const unit = alertMetricUnit(type)
  const hasNums = Number.isFinite(current) && Number.isFinite(threshold)
  const delta = hasNums ? current - threshold : null
  const below = delta != null && delta < 0
  if (type === 'LOW_T1') {
    return hasNums
      ? `T1 coherence on this qubit is ${Math.abs(delta!).toFixed(2)}${unit} ${below ? 'below' : 'above'} the ${threshold.toFixed(1)}${unit} floor. Below-floor T1 raises decoherence risk for circuits that rely on this qubit.`
      : 'LOW_T1 detector fired; numeric reading unavailable from API.'
  }
  if (type === 'LOW_T2') {
    return hasNums
      ? `T2 dephasing time is ${Math.abs(delta!).toFixed(2)}${unit} ${below ? 'below' : 'above'} threshold ${threshold.toFixed(1)}${unit}.`
      : 'LOW_T2 detector fired; numeric reading unavailable.'
  }
  return hasNums
    ? `Detector ${type}: observed ${current.toFixed(2)}${unit ? ` ${unit}` : ''} vs threshold ${threshold.toFixed(2)}${unit ? ` ${unit}` : ''} (Δ ${delta!.toFixed(2)}).`
    : `Detector ${type} fired on ${String(row.resource_id || 'resource')}.`
}