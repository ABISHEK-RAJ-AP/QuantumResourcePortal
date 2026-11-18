import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { authCapabilitiesKey, fetchAuthCapabilities, type AuthCapabilities } from '@/api/authCapabilities'
import { StatusBadge } from '@/components/status/StatusBadge'
import { Card, PanelHeader } from '@/components/layout/Page'
import { isAuthCaptchaEnabled } from '@/lib/authCaptcha'

function yesNo(value: boolean) {
  return value ? (
    <StatusBadge tone="success" label="Yes" />
  ) : (
    <StatusBadge tone="neutral" label="No" />
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  )
}

function panelFrom(data: AuthCapabilities) {
  const viteCaptcha = isAuthCaptchaEnabled()
  const captchaMismatch = viteCaptcha && !data.captcha_enabled
  return (
    <div className="divide-y divide-border/60">
      <Row label="API profile">
        {data.profile.toUpperCase()} · v{data.version}
      </Row>
      <Row label="Local login">{yesNo(data.federation.local_login)}</Row>
      <Row label="CAPTCHA (API)">{yesNo(data.captcha_enabled)}</Row>
      <Row label="CAPTCHA (SPA build)">{yesNo(viteCaptcha)}</Row>
      {captchaMismatch ? (
        <p className="py-2 text-sm text-warning-text">
          SPA shows captcha fields but the API has captcha disabled. Set <code className="font-mono text-xs">VITE_QRE_CAPTCHA=0</code>{' '}
          or enable <code className="font-mono text-xs">QRE_CAPTCHA_ENABLED</code> on the server.
        </p>
      ) : null}
      <Row label="MFA required (config)">{yesNo(data.mfa_required)}</Row>
      <Row label="MFA verification API">{yesNo(data.mfa_verification_available)}</Row>
      <Row label="Password self-service">{yesNo(data.password_self_service)}</Row>
      <Row label="Self-registration">{yesNo(data.self_registration)}</Row>
      <Row label="OIDC / SAML">
        {data.federation.oidc || data.federation.saml ? 'Configured' : 'Not configured'}
      </Row>
      <Row label="Procurement module">{yesNo(data.features.procurement_entitlements)}</Row>
      {data.features.demo_seed != null ? <Row label="Demo seed (lab)">{yesNo(data.features.demo_seed)}</Row> : null}
      {data.features.demo_simulation != null ? (
        <Row label="Demo simulation (lab)">{yesNo(data.features.demo_simulation)}</Row>
      ) : null}
      <Row label="Session store">{data.session.store ?? 'postgresql'}</Row>
      <Row label="Redis cache">{yesNo(data.cache?.connected ?? false)}</Row>
      <Row label="Cache backend">{data.cache?.backend ?? '—'}</Row>
      <Row label="Session idle">{data.session.idle_minutes} min</Row>
      <Row label="Session max">{data.session.absolute_hours} h</Row>
      {data.roadmap?.mfa_methods_planned?.length ? (
        <p className="pt-2 text-xs text-muted-foreground">
          Planned MFA channels (not active): {data.roadmap.mfa_methods_planned.join(', ')}.
        </p>
      ) : null}
    </div>
  )
}

export function DeploymentCapabilitiesPanel({ compact }: { compact?: boolean }) {
  const query = useQuery({
    queryKey: authCapabilitiesKey,
    queryFn: fetchAuthCapabilities,
    staleTime: 60_000,
  })

  if (compact) {
    return (
      <Card className="text-sm">
        <PanelHeader title="Deployment capabilities" />
        {query.isError ? (
          <p className="text-muted-foreground">Could not load /auth/capabilities.</p>
        ) : query.isPending ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          panelFrom(query.data)
        )}
      </Card>
    )
  }

  return (
    <Card>
      <PanelHeader title="Authentication & deployment" />
      {query.isError ? (
        <p className="text-sm text-muted-foreground">Could not load deployment capabilities from the API.</p>
      ) : query.isPending ? (
        <p className="text-sm text-muted-foreground">Loading capabilities…</p>
      ) : (
        panelFrom(query.data)
      )}
    </Card>
  )
}