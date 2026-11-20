import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  GraduationCap,
  Landmark,
  Layers,
  Rocket,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import { AuthCaptchaBlock } from '@/components/auth/AuthCaptchaBlock'
import { AuthRegisterStudio } from '@/components/auth/AuthRegisterStudio'
import { RegisterStepTrail, type RegisterTrailStep } from '@/components/auth/RegisterStepTrail'
import { AuthBackdropSync } from '@/components/auth/authBackdrop'
import { AuthFieldHint, AuthOutlineField, AuthPasswordField, authOutlineControlClass } from '@/components/auth/AuthOutlineField'
import { FormBanner } from '@/components/auth/FormAlerts'
import { authCapabilitiesKey, fetchAuthCapabilities } from '@/api/authCapabilities'
import { registerOrganization } from '@/api/orgRegister'
import { validateCaptchaBeforeSubmit } from '@/lib/authCaptcha'
import { useAuthCaptchaRequired } from '@/hooks/useAuthCaptchaRequired'
import { formatApiError } from '@/lib/apiMessage'
import { LogoMark } from '@/components/brand/LogoMark'
import { AUTH_COPY } from '@/copy/auth'

const ORG_KINDS: {
  id: 'startup' | 'academia' | 'student' | 'psu' | 'individual' | 'other'
  label: string
  hint: string
  icon: LucideIcon
}[] = [
  { id: 'startup', label: 'Startup / company', hint: 'Product teams and private R&D using shared quantum capacity.', icon: Rocket },
  { id: 'academia', label: 'University / research lab', hint: 'Campus labs, departments, and national programmes.', icon: GraduationCap },
  { id: 'student', label: 'Student programme', hint: 'Training cohorts with scoped quotas and supervisors.', icon: UserRound },
  { id: 'psu', label: 'PSU / government unit', hint: 'Public-sector programmes with governance requirements.', icon: Landmark },
  { id: 'individual', label: 'Independent researcher', hint: 'Single-investigator workspace with personal quotas.', icon: Building2 },
  { id: 'other', label: 'Other', hint: 'Partnerships and consortia that do not fit the categories above.', icon: Layers },
]

const HEAD: Record<RegisterTrailStep, { title: string; subtitle: string }> = {
  org: { title: 'Register your organization', subtitle: AUTH_COPY.registerOrgStepSubtitle },
  admin: { title: 'Administrator account', subtitle: AUTH_COPY.registerAdminStepSubtitle },
  security: { title: 'Security', subtitle: AUTH_COPY.registerSecurityStepSubtitle },
}

const ASIDE: Record<RegisterTrailStep, string> = {
  org: AUTH_COPY.registerOrgAside,
  admin: AUTH_COPY.registerAdminAside,
  security: AUTH_COPY.registerSecurityAside,
}

function stepToTrail(step: number): RegisterTrailStep {
  if (step === 2) return 'admin'
  if (step === 3) return 'security'
  return 'org'
}

export function RegisterPage() {
  const navigate = useNavigate()
  const caps = useQuery({ queryKey: authCapabilitiesKey, queryFn: fetchAuthCapabilities, staleTime: 60_000 })
  const selfReg = caps.data?.organization_registration ?? caps.data?.self_registration
  const captchaEnabled = useAuthCaptchaRequired()
  const [step, setStep] = useState(1)
  const [orgKind, setOrgKind] = useState<(typeof ORG_KINDS)[number]['id']>('startup')
  const [tenantCode, setTenantCode] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [adminDisplayName, setAdminDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaOn, setCaptchaOn] = useState(false)
  const [banner, setBanner] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [busy, setBusy] = useState(false)

  const trail = stepToTrail(step)
  const panelHead = HEAD[trail]
  const footer = (
    <>
      Already have an account? <Link to="/login">Sign in</Link>
    </>
  )

  function nextFromOrg() {
    setBanner('')
    const code = tenantCode.trim()
    const name = tenantName.trim()
    if (code.length < 2) {
      setBanner('Organization code must be at least 2 characters (letters, digits, hyphen).')
      return
    }
    if (name.length < 2) {
      setBanner('Enter the full organization name.')
      return
    }
    setStep(2)
  }

  function nextFromAdmin() {
    setBanner('')
    const user = adminUsername.trim().toLowerCase()
    const dn = adminDisplayName.trim()
    if (user.length < 3) {
      setBanner('Administrator username must be at least 3 characters.')
      return
    }
    if (!dn) {
      setBanner('Enter the administrator display name.')
      return
    }
    setStep(3)
  }

  async function submit() {
    setBanner('')
    setFieldError('')
    const err = validateCaptchaBeforeSubmit(captchaEnabled, captchaOn, captchaCode)
    if (err) {
      if (err.includes('Enter the')) setFieldError(err)
      else setBanner(err)
      return
    }
    if (password.length < 12) {
      setBanner('Password must be at least 12 characters.')
      return
    }
    if (password !== confirmPassword) {
      setBanner('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const result = await registerOrganization({
        tenant_code: tenantCode.trim(),
        tenant_name: tenantName.trim(),
        admin_username: adminUsername.trim().toLowerCase(),
        admin_display_name: adminDisplayName.trim(),
        email: email.trim() || undefined,
        password,
        confirm_password: confirmPassword,
        org_kind: orgKind,
        captcha_id: captchaId || undefined,
        captcha_code: captchaCode || undefined,
      })
      navigate('/login', {
        replace: true,
        state: {
          registeredOrg: result.tenant_code,
          registeredUser: result.admin_username,
        },
      })
    } catch (e) {
      setBanner(formatApiError(e))
    } finally {
      setBusy(false)
    }
  }

  if (caps.isSuccess && !selfReg) {
    return (
      <AuthRegisterStudio footer={footer}>
        <header className="reg-cert-head">
          <h1>Request access</h1>
          <p>{AUTH_COPY.registerClosed}</p>
        </header>
        <p className="reg-type-empty">
          Your platform operator (for example CDAC) creates organizations and invites members. Sign in once an
          administrator has provisioned your account.{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </AuthRegisterStudio>
    )
  }

  return (
    <AuthRegisterStudio footer={footer}>
      <AuthBackdropSync username={adminUsername} password={password} captchaInput={captchaCode} />
      <header className="reg-cert-head">
        <h1>{panelHead.title}</h1>
        <p>{panelHead.subtitle}</p>
      </header>
      <RegisterStepTrail current={trail} />
      <FormBanner message={banner} />

      <div className="reg-stage reg-stage--flow reg-stage--detail">
        <div className="reg-stage__brand">
          <LogoMark className="reg-stage__logo h-12 w-auto max-w-[120px]" aria-hidden />
          <p className="reg-stage__wordmark">Quantum Resource Portal</p>
          <aside className="reg-stage__aside" aria-label="Registration guidance">
            <p className="reg-stage__aside-text">{ASIDE[trail]}</p>
          </aside>
        </div>

        <div className="reg-stage__form">
          {step === 1 ? (
            <form
              className="reg-form-stack"
              onSubmit={(e) => {
                e.preventDefault()
                nextFromOrg()
              }}
              noValidate
            >
              <p className="reg-stage__label">Organization type</p>
              <div className="reg-type-grid reg-type-grid--tiles" role="listbox" aria-label="Organization type">
                {ORG_KINDS.map((type) => {
                  const Icon = type.icon
                  const active = orgKind === type.id
                  return (
                    <button
                      key={type.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`reg-type-tile${active ? ' reg-type-tile--active' : ''}${type.id === 'other' ? ' reg-type-tile--other' : ''}`}
                      onClick={() => setOrgKind(type.id)}
                    >
                      <span className="reg-type-tile__row">
                        <Icon className="reg-type-tile__icon" strokeWidth={2} aria-hidden />
                        <span className="reg-type-tile__title">{type.label}</span>
                      </span>
                      <span className="reg-type-tile__hint">{type.hint}</span>
                    </button>
                  )
                })}
              </div>
              <AuthOutlineField label="Organization code" htmlFor="register-tenant-code">
                <input
                  id="register-tenant-code"
                  className={`${authOutlineControlClass} font-mono text-sm`}
                  placeholder="e.g. acme-quantum"
                  value={tenantCode}
                  onChange={(e) => setTenantCode(e.target.value)}
                  autoComplete="organization"
                />
              </AuthOutlineField>
              <AuthFieldHint>Short id for URLs and support (2–32 chars).</AuthFieldHint>
              <AuthOutlineField label="Legal / display name" htmlFor="register-tenant-name">
                <input
                  id="register-tenant-name"
                  className={authOutlineControlClass}
                  placeholder="e.g. Acme Quantum Research Pvt Ltd"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                />
              </AuthOutlineField>
              <button type="submit" className="btn-primary qrp-auth-submit auth-cta w-full reg-flow-nav__next">
                Continue
              </button>
            </form>
          ) : null}

          {step === 2 ? (
            <form
              className="reg-form-stack reg-form-stack--profile"
              onSubmit={(e) => {
                e.preventDefault()
                nextFromAdmin()
              }}
              noValidate
            >
              <p className="reg-org-crumb" title={`${tenantName} (${tenantCode})`}>
                <span className="reg-org-crumb__label">Organization</span>
                {tenantName || tenantCode}
              </p>
              <AuthOutlineField label="Administrator username" htmlFor="register-admin-user">
                <input
                  id="register-admin-user"
                  className={`${authOutlineControlClass} font-mono text-sm`}
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  autoComplete="username"
                />
              </AuthOutlineField>
              <AuthOutlineField label="Full name" htmlFor="register-admin-name">
                <input
                  id="register-admin-name"
                  className={authOutlineControlClass}
                  value={adminDisplayName}
                  onChange={(e) => setAdminDisplayName(e.target.value)}
                  autoComplete="name"
                />
              </AuthOutlineField>
              <AuthOutlineField label="Work email (optional)" htmlFor="register-admin-email">
                <input
                  id="register-admin-email"
                  type="email"
                  className={authOutlineControlClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </AuthOutlineField>
              <div className="reg-flow-nav">
                <button type="button" className="reg-flow-nav__back" onClick={() => setStep(1)} disabled={busy}>
                  Back
                </button>
                <button type="submit" className="btn-primary qrp-auth-submit auth-cta reg-flow-nav__next" disabled={busy}>
                  Continue
                </button>
              </div>
            </form>
          ) : null}

          {step === 3 ? (
            <form
              className="reg-form-stack"
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
              noValidate
            >
              <p className="reg-org-crumb" title={adminUsername}>
                <span className="reg-org-crumb__label">Administrator</span>
                {adminUsername || '—'}
              </p>
              <AuthCaptchaBlock
                captchaCode={captchaCode}
                onCodeChange={setCaptchaCode}
                onChallenge={setCaptchaId}
                onAvailability={setCaptchaOn}
                fieldError={fieldError}
              />
              <AuthPasswordField
                label="Password"
                htmlFor="register-password"
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
              />
              <AuthPasswordField
                label="Confirm password"
                htmlFor="register-password-confirm"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
              />
              <AuthFieldHint>At least 12 characters (platform policy).</AuthFieldHint>
              <div className="reg-flow-nav">
                <button type="button" className="reg-flow-nav__back" onClick={() => setStep(2)} disabled={busy}>
                  Back
                </button>
                <button
                  type="submit"
                  className="btn-primary qrp-auth-submit auth-cta reg-flow-nav__next"
                  disabled={busy}
                >
                  {busy ? 'Creating organization…' : 'Create organization'}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </AuthRegisterStudio>
  )
}