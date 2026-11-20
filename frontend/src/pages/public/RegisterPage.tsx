import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'

import { AuthCaptchaBlock } from '@/components/auth/AuthCaptchaBlock'
import { AuthPanel } from '@/components/auth/AuthPanel'
import { AuthBackdropSync } from '@/components/auth/authBackdrop'
import { AuthFieldHint, AuthOutlineField, AuthPasswordField, authOutlineControlClass } from '@/components/auth/AuthOutlineField'
import { FormBanner } from '@/components/auth/FormAlerts'
import { authCapabilitiesKey, fetchAuthCapabilities } from '@/api/authCapabilities'
import { registerOrganization } from '@/api/orgRegister'
import { validateCaptchaBeforeSubmit } from '@/lib/authCaptcha'
import { useAuthCaptchaRequired } from '@/hooks/useAuthCaptchaRequired'
import { formatApiError } from '@/lib/apiMessage'
import { AUTH_COPY } from '@/copy/auth'

const ORG_KINDS = [
  { id: 'startup', label: 'Startup / company' },
  { id: 'academia', label: 'University / research lab' },
  { id: 'student', label: 'Student programme' },
  { id: 'psu', label: 'PSU / government unit' },
  { id: 'individual', label: 'Independent researcher' },
  { id: 'other', label: 'Other' },
] as const

const STEPS = ['Organization', 'Administrator', 'Security'] as const

const STEP_SUBTITLE: Record<number, string> = {
  1: AUTH_COPY.registerOrgStepSubtitle,
  2: AUTH_COPY.registerAdminStepSubtitle,
  3: AUTH_COPY.registerSecurityStepSubtitle,
}

function RegisterStepIndicator({ step }: { step: number }) {
  return (
    <ol className="cert-register-steps mb-6 justify-center" aria-label="Registration progress">
      {STEPS.map((label, i) => {
        const n = i + 1
        const done = n < step
        const active = n === step
        return (
          <li
            key={label}
            className={`cert-register-steps__item${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
          >
            <span className="cert-register-steps__dot" aria-hidden>
              {done ? <Check className="size-3" /> : n}
            </span>
            <span className="cert-register-steps__label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function RegisterCertFooter() {
  return (
    <div className="cert-auth-footer">
      <p>
        Already have an account?{' '}
        <Link to="/login" className="cert-auth-link">
          Sign in here
        </Link>
      </p>
    </div>
  )
}

/**
 * Cert Studio auth shell (centred register card) + QRP org-tenant stepped flow.
 */
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

  const panelSubtitle = step === 1 ? AUTH_COPY.registerSubtitle : STEP_SUBTITLE[step]

  if (caps.isSuccess && !selfReg) {
    return (
      <AuthPanel
        wide
        showBackLink
        title="Request access"
        subtitle={AUTH_COPY.registerClosed}
        footer={<RegisterCertFooter />}
      >
        <p className="cert-auth-prose">{AUTH_COPY.registerOrgAside}</p>
        <Link to="/login" className="btn-primary qrp-auth-submit auth-cta w-full text-center">
          Continue to sign in
        </Link>
      </AuthPanel>
    )
  }

  return (
    <AuthPanel
      wide
      showBackLink
      title="Register your organization"
      subtitle={panelSubtitle}
      footer={<RegisterCertFooter />}
    >
      <AuthBackdropSync username={adminUsername} password={password} captchaInput={captchaCode} />
      <RegisterStepIndicator step={step} />
      <FormBanner message={banner} />

      {step === 1 ? (
        <OrgStep
          orgKind={orgKind}
          setOrgKind={setOrgKind}
          tenantCode={tenantCode}
          setTenantCode={setTenantCode}
          tenantName={tenantName}
          setTenantName={setTenantName}
          onNext={nextFromOrg}
        />
      ) : null}

      {step === 2 ? (
        <AdminStep
          tenantLabel={tenantName || tenantCode}
          adminUsername={adminUsername}
          setAdminUsername={setAdminUsername}
          adminDisplayName={adminDisplayName}
          setAdminDisplayName={setAdminDisplayName}
          email={email}
          setEmail={setEmail}
          busy={busy}
          onBack={() => setStep(1)}
          onNext={nextFromAdmin}
        />
      ) : null}

      {step === 3 ? (
        <SecurityStep
          adminUsername={adminUsername}
          password={password}
          setPassword={setPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          captchaCode={captchaCode}
          setCaptchaCode={setCaptchaCode}
          captchaId={captchaId}
          setCaptchaId={setCaptchaId}
          setCaptchaOn={setCaptchaOn}
          fieldError={fieldError}
          busy={busy}
          onBack={() => setStep(2)}
          onSubmit={() => void submit()}
        />
      ) : null}
    </AuthPanel>
  )
}

function OrgStep({
  orgKind,
  setOrgKind,
  tenantCode,
  setTenantCode,
  tenantName,
  setTenantName,
  onNext,
}: {
  orgKind: (typeof ORG_KINDS)[number]['id']
  setOrgKind: (v: (typeof ORG_KINDS)[number]['id']) => void
  tenantCode: string
  setTenantCode: (v: string) => void
  tenantName: string
  setTenantName: (v: string) => void
  onNext: () => void
}) {
  return (
    <form
      className="cert-auth-form"
      onSubmit={(e) => {
        e.preventDefault()
        onNext()
      }}
      noValidate
    >
      <fieldset className="cert-register-fieldset">
        <legend className="cert-register-fieldset__legend">Organization type</legend>
        <div className="cert-org-kind-grid">
          {ORG_KINDS.map(({ id, label }) => (
            <label key={id} className={`cert-org-kind-option${orgKind === id ? ' is-selected' : ''}`}>
              <input type="radio" name="org_kind" checked={orgKind === id} onChange={() => setOrgKind(id)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
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
      <button type="submit" className="btn-primary qrp-auth-submit auth-cta w-full">
        Continue
      </button>
    </form>
  )
}

function AdminStep({
  tenantLabel,
  adminUsername,
  setAdminUsername,
  adminDisplayName,
  setAdminDisplayName,
  email,
  setEmail,
  busy,
  onBack,
  onNext,
}: {
  tenantLabel: string
  adminUsername: string
  setAdminUsername: (v: string) => void
  adminDisplayName: string
  setAdminDisplayName: (v: string) => void
  email: string
  setEmail: (v: string) => void
  busy: boolean
  onBack: () => void
  onNext: () => void
}) {
  return (
    <form
      className="cert-auth-form"
      onSubmit={(e) => {
        e.preventDefault()
        onNext()
      }}
      noValidate
    >
      <p className="cert-register-crumb" title={tenantLabel}>
        <span className="cert-register-crumb__label">Organization</span>
        {tenantLabel}
      </p>
      <p className="cert-auth-prose cert-auth-prose--tight">{AUTH_COPY.registerAdminAside}</p>
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
      <div className="cert-auth-actions">
        <button type="button" className="btn-ghost" onClick={onBack} disabled={busy}>
          Back
        </button>
        <button type="submit" className="btn-primary qrp-auth-submit auth-cta" disabled={busy}>
          Continue
        </button>
      </div>
    </form>
  )
}

function SecurityStep({
  adminUsername,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  captchaCode,
  setCaptchaCode,
  setCaptchaId,
  setCaptchaOn,
  fieldError,
  busy,
  onBack,
  onSubmit,
}: {
  adminUsername: string
  password: string
  setPassword: (v: string) => void
  confirmPassword: string
  setConfirmPassword: (v: string) => void
  captchaCode: string
  setCaptchaCode: (v: string) => void
  captchaId: string
  setCaptchaId: (v: string) => void
  setCaptchaOn: (v: boolean) => void
  fieldError: string
  busy: boolean
  onBack: () => void
  onSubmit: () => void
}) {
  return (
    <form
      className="cert-auth-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      noValidate
    >
      <p className="cert-register-crumb" title={adminUsername}>
        <span className="cert-register-crumb__label">Administrator</span>
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
      <div className="cert-auth-actions">
        <button type="button" className="btn-ghost" onClick={onBack} disabled={busy}>
          Back
        </button>
        <button type="submit" className="btn-primary qrp-auth-submit auth-cta" disabled={busy}>
          {busy ? 'Creating organization…' : 'Create organization'}
        </button>
      </div>
    </form>
  )
}