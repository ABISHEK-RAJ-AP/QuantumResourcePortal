import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Building2,
  FileText,
  GraduationCap,
  Heart,
  Landmark,
  Layers,
  Scale,
  type LucideIcon,
} from 'lucide-react'

import { AuthCaptchaBlock } from '@/components/auth/AuthCaptchaBlock'
import { AuthRegisterWideShell } from '@/components/auth/AuthRegisterWideShell'
import { RegisterFlowStepper, type RegisterFlowPhase } from '@/components/auth/RegisterFlowStepper'
import { AuthBackdropSync } from '@/components/auth/authBackdrop'
import { AuthFieldHint, AuthOutlineField, AuthPasswordField, authOutlineControlClass } from '@/components/auth/AuthOutlineField'
import { FormBanner } from '@/components/auth/FormAlerts'
import { authCapabilitiesKey, fetchAuthCapabilities } from '@/api/authCapabilities'
import { registerOrganization } from '@/api/orgRegister'
import { validateCaptchaBeforeSubmit } from '@/lib/authCaptcha'
import { useAuthCaptchaRequired } from '@/hooks/useAuthCaptchaRequired'
import { formatApiError } from '@/lib/apiMessage'
import { AUTH_COPY } from '@/copy/auth'

const ORG_KIND_IDS = ['central_gov', 'state_gov', 'psu', 'academia', 'judiciary', 'bfsi', 'ngo', 'cag', 'startup', 'other'] as const

type OrgKindId = (typeof ORG_KIND_IDS)[number]

/** Organisation tiles — labels align with reference mock; `org_kind` is QRP advisory field. */
const ORG_TILES: {
  id: OrgKindId
  label: string
  hint: string
  icon: LucideIcon
}[] = [
  { id: 'central_gov', label: 'Central Government', hint: 'Ministries, departments, national programmes', icon: Landmark },
  { id: 'state_gov', label: 'State Government', hint: 'State departments and agencies', icon: Building2 },
  { id: 'psu', label: 'PSU / Public Sector', hint: 'Public sector undertakings and units', icon: Landmark },
  { id: 'academia', label: 'Academics & Education', hint: 'Universities, campuses, research schools', icon: GraduationCap },
  { id: 'judiciary', label: 'Judiciary', hint: 'Courts and legal institutions', icon: Scale },
  { id: 'bfsi', label: 'BFSI', hint: 'Banks, financial services, insurance', icon: Building2 },
  { id: 'ngo', label: 'NGO / Non-profit', hint: 'Foundations and civil society', icon: Heart },
  { id: 'cag', label: 'CAG / Audit', hint: 'Audit and oversight bodies', icon: FileText },
  { id: 'startup', label: 'Private Organisation', hint: 'Industry, startups, commercial teams', icon: Building2 },
  { id: 'other', label: 'Other', hint: 'Consortia and partnerships', icon: Layers },
]

const REGISTER_DRAFT_KEY = 'qrp:register-draft:v1'

type RegisterDraft = {
  phase: RegisterFlowPhase
  orgTypeId: OrgKindId
  tenantCode: string
  tenantName: string
  adminUsername: string
  adminDisplayName: string
  email: string
}

function readRegisterDraft(): Partial<RegisterDraft> | null {
  try {
    const raw = sessionStorage.getItem(REGISTER_DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Partial<RegisterDraft>) : null
  } catch {
    return null
  }
}

function mapOrgKind(id: OrgKindId): string {
  if (id === 'central_gov' || id === 'state_gov' || id === 'judiciary' || id === 'cag' || id === 'bfsi' || id === 'ngo') {
    return id === 'central_gov' || id === 'state_gov' ? 'psu' : 'other'
  }
  if (id === 'psu') return 'psu'
  if (id === 'academia') return 'academia'
  if (id === 'startup') return 'startup'
  return 'other'
}

export function RegisterPage() {
  const navigate = useNavigate()
  const caps = useQuery({ queryKey: authCapabilitiesKey, queryFn: fetchAuthCapabilities, staleTime: 60_000 })
  const selfReg = caps.data?.organization_registration ?? caps.data?.self_registration
  const captchaEnabled = useAuthCaptchaRequired()
  const saved = readRegisterDraft()
  const [phase, setPhase] = useState<RegisterFlowPhase>(saved?.phase ?? 'type')
  const [orgTypeId, setOrgTypeId] = useState<OrgKindId>(saved?.orgTypeId ?? 'central_gov')
  const [tenantCode, setTenantCode] = useState(saved?.tenantCode ?? '')
  const [tenantName, setTenantName] = useState(saved?.tenantName ?? '')
  const [adminUsername, setAdminUsername] = useState(saved?.adminUsername ?? '')
  const [adminDisplayName, setAdminDisplayName] = useState(saved?.adminDisplayName ?? '')
  const [email, setEmail] = useState(saved?.email ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaOn, setCaptchaOn] = useState(false)
  const [banner, setBanner] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const draft: RegisterDraft = {
      phase,
      orgTypeId,
      tenantCode,
      tenantName,
      adminUsername,
      adminDisplayName,
      email,
    }
    try {
      sessionStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* quota / private mode */
    }
  }, [phase, orgTypeId, tenantCode, tenantName, adminUsername, adminDisplayName, email])

  async function createOrg() {
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
        org_kind: mapOrgKind(orgTypeId),
        captcha_id: captchaId || undefined,
        captcha_code: captchaCode || undefined,
      })
      try {
        sessionStorage.removeItem(REGISTER_DRAFT_KEY)
      } catch {
        /* ignore */
      }
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
      <AuthRegisterWideShell>
        <header className="reg-cert-head">
          <h1>Request access</h1>
        </header>
        <p className="cert-auth-prose">{AUTH_COPY.registerClosed}</p>
        <Link to="/login" className="btn-primary qrp-auth-submit auth-cta qrp-register-flow__continue">
          Continue to sign in <ArrowRight className="size-4" aria-hidden />
        </Link>
        <FooterSignIn />
      </AuthRegisterWideShell>
    )
  }

  return (
    <AuthRegisterWideShell>
      <AuthBackdropSync username={adminUsername} password={password} captchaInput={captchaCode} />
      <header className="reg-cert-head qrp-register-flow__title-row">
        <h1>Register your organisation</h1>
        <button type="button" className="qrp-register-flow__info" title={AUTH_COPY.registerOrgAside} aria-label="About organisation registration">
          i
        </button>
      </header>
      <RegisterFlowStepper phase={phase} />
      <FormBanner message={banner} />

      {phase === 'type' ? (
        <>
          <div className="qrp-register-flow__section-head">
            <h2>What type of organisation are you registering?</h2>
            <Link to="/login" className="qrp-register-flow__meta-link">
              Already waiting? Account status
            </Link>
          </div>
          <div className="reg-type-grid reg-type-grid--tiles" role="listbox" aria-label="Organisation type">
            {ORG_TILES.map((type) => {
              const Icon = type.icon
              const active = orgTypeId === type.id
              return (
                <button
                  key={type.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`reg-type-tile${active ? ' reg-type-tile--active' : ''}`}
                  onClick={() => setOrgTypeId(type.id)}
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
          <button
            type="button"
            className="btn-primary qrp-auth-submit auth-cta qrp-register-flow__continue"
            onClick={() => {
              setBanner('')
              setPhase('details')
            }}
          >
            Continue <ArrowRight className="size-4" aria-hidden />
          </button>
        </>
      ) : null}

      {phase === 'details' ? (
        <form
          className="cert-auth-form"
          onSubmit={(e) => {
            e.preventDefault()
            setBanner('')
            const code = tenantCode.trim()
            const name = tenantName.trim()
            const user = adminUsername.trim().toLowerCase()
            const dn = adminDisplayName.trim()
            if (code.length < 2) {
              setBanner('Organisation code must be at least 2 characters.')
              return
            }
            if (name.length < 2) {
              setBanner('Enter the legal or display name.')
              return
            }
            if (user.length < 3) {
              setBanner('Username must be at least 3 characters.')
              return
            }
            if (!dn) {
              setBanner('Enter your full name.')
              return
            }
            setPhase('security')
          }}
          noValidate
        >
          <p className="cert-register-crumb" title={ORG_TILES.find((t) => t.id === orgTypeId)?.label}>
            <span className="cert-register-crumb__label">Organisation type</span>
            {ORG_TILES.find((t) => t.id === orgTypeId)?.label}
          </p>
          <AuthOutlineField label="Organisation code" htmlFor="register-tenant-code">
            <input
              id="register-tenant-code"
              className={`${authOutlineControlClass} font-mono text-sm`}
              placeholder="e.g. acme-quantum"
              value={tenantCode}
              onChange={(e) => setTenantCode(e.target.value)}
            />
          </AuthOutlineField>
          <AuthFieldHint>Short id for URLs and support (2–32 chars).</AuthFieldHint>
          <AuthOutlineField label="Legal / display name" htmlFor="register-tenant-name">
            <input
              id="register-tenant-name"
              className={authOutlineControlClass}
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
            />
          </AuthOutlineField>
          <AuthOutlineField label="Your username" htmlFor="register-admin-user">
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
          <div className="cert-auth-actions">
            <button type="button" className="btn-ghost" onClick={() => setPhase('type')}>
              Back
            </button>
            <button type="submit" className="btn-primary qrp-auth-submit auth-cta">
              Continue <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        </form>
      ) : null}

      {phase === 'security' ? (
        <form
          className="cert-auth-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (password.length < 12) {
              setBanner('Password must be at least 12 characters.')
              return
            }
            if (password !== confirmPassword) {
              setBanner('Passwords do not match.')
              return
            }
            setBanner('')
            setPhase('verify')
          }}
          noValidate
        >
          <AuthPasswordField label="Password" htmlFor="reg-pw" autoComplete="new-password" value={password} onChange={setPassword} />
          <AuthPasswordField
            label="Confirm password"
            htmlFor="reg-pw2"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
          <AuthFieldHint>At least 12 characters (platform policy).</AuthFieldHint>
          <div className="cert-auth-actions">
            <button type="button" className="btn-ghost" onClick={() => setPhase('details')}>
              Back
            </button>
            <button type="submit" className="btn-primary qrp-auth-submit auth-cta">
              Continue <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        </form>
      ) : null}

      {phase === 'verify' ? (
        <form
          className="cert-auth-form"
          onSubmit={(e) => {
            e.preventDefault()
            void createOrg()
          }}
          noValidate
        >
          <p className="cert-auth-prose">
            Lab deployments skip email OTP. Confirm and create your organisation; you will sign in on the next screen with
            the administrator credentials you chose.
          </p>
          <AuthCaptchaBlock
            captchaCode={captchaCode}
            onCodeChange={setCaptchaCode}
            onChallenge={setCaptchaId}
            onAvailability={setCaptchaOn}
            fieldError={fieldError}
          />
          <div className="cert-auth-actions">
            <button type="button" className="btn-ghost" onClick={() => setPhase('security')} disabled={busy}>
              Back
            </button>
            <button type="submit" className="btn-primary qrp-auth-submit auth-cta" disabled={busy}>
              {busy ? 'Creating organisation…' : 'Create organisation'}
            </button>
          </div>
        </form>
      ) : null}

      <FooterSignIn />
    </AuthRegisterWideShell>
  )
}

function FooterSignIn() {
  return (
    <div className="qrp-register-flow__footer">
      Already have an account? <Link to="/login">Sign in</Link>
    </div>
  )
}