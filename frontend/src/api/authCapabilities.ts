import { authFetch } from '@/api/qre'

export type AuthCapabilities = {
  version: string
  profile: string
  captcha_enabled: boolean
  mfa_required: boolean
  mfa_verification_available: boolean
  mfa_enrollment_available: boolean
  password_self_service: boolean
  self_registration: boolean
  federation: { oidc: boolean; saml: boolean; local_login: boolean }
  features: { procurement_entitlements: boolean; row_level_security: boolean }
  session: { idle_minutes: number; absolute_hours: number; cookie_secure: boolean }
  roadmap?: { mfa_methods_planned?: string[] }
}

export const authCapabilitiesKey = ['auth', 'capabilities'] as const

export function fetchAuthCapabilities(): Promise<AuthCapabilities> {
  return authFetch<AuthCapabilities>('/auth/capabilities')
}