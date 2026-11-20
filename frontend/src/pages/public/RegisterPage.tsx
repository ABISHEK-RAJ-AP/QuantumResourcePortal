import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'

import { AuthCaptchaBlock } from '@/components/auth/AuthCaptchaBlock'
import { AuthBackdropSync } from '@/components/auth/authBackdrop'
import { AuthFooterLinks, AuthPanel } from '@/components/auth/AuthPanel'
import { AuthFieldHint, AuthOutlineField, AuthPasswordField, authOutlineControlClass } from '@/components/auth/AuthOutlineField'
import { FormBanner } from '@/components/auth/FormAlerts'
import { authCapabilitiesKey, fetchAuthCapabilities } from '@/api/authCapabilities'
import { registerOrganization } from '@/api/orgRegister'
import { validateCaptchaBeforeSubmit } from '@/lib/authCaptcha'
import { useAuthCaptchaRequired } from '@/hooks/useAuthCaptchaRequired'
import { formatApiError } from '@/lib/apiMessage'

const ORG_KINDS = [
  { id: 'startup', label: 'Startup / company' },
  { id: 'academia', label: 'University / research lab' },
  { id: 'student', label: 'Student programme' },
  { id: 'psu', label: 'PSU / government unit' },
  { id: 'individual', label: 'Independent researcher' },
  { id: 'other', label: 'Other' },
] as const

const STEPS = ['Organization', 'Administrator', 'Security'] as const

function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="cert-register-steps mb-6" aria-label="Registration progress">
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

/**
 * Cert Studio–style organization onboarding: new tenant + first org admin (when deployment allows).
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

  if (caps.isSuccess && !selfReg) {
    return (
      <AuthPanel
        title="Request access"
        subtitle="Organization sign-up is disabled on this deployment"
        footer={<AuthFooterLinks showForgot />}
      >
        <AuthBackdropSync captchaInput={captchaCode} />
        <p className="cert-auth-prose">
          Your platform operator (for example CDAC) creates organizations and invites members. Sign in once an
          administrator has provisioned your account.
        </p>
        <AuthCaptchaBlock
          captchaCode={captchaCode}
          onCodeChange={setCaptchaCode}
          onChallenge={setCaptchaId}
          onAvailability={setCaptchaOn}
          fieldError={fieldError}
        />
        <div className="cert-auth-form">
          <button
            type="button"
            className="btn-primary qrp-auth-submit auth-cta w-full"
            onClick={() => navigate('/login', { state: { accessRequest: true, captcha_id: captchaId } })}
          >
            Continue to sign in
          </button>
        </div>
      </AuthPanel>
    )
  }

  return (
    <AuthPanel
      wide
      title="Register your organization"
      subtitle="Create an isolated workspace on the quantum resource platform"
      footer={
        <>
          <AuthFooterLinks showForgot showHome />
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link className="cert-auth-link" to="/login">
              Sign in
            </Link>
          </p>
        </>
      }
    >
      <AuthBackdropSync username={adminUsername} password={password} captchaInput={captchaCode} />
      <p className="cert-auth-prose">
        Each organization is a separate tenant: own members, projects, quotas, and usage. CDAC operates the shared
        provider catalog; you govern people and workloads inside your org.
      </p>
      <StepIndicator step={step} />
      <FormBanner message={banner} />

      {step === 1 ? (
        <RequestOrgStep
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
          adminUsername={adminUsername}
          setAdminUsername={setAdminUsername}
          adminDisplayName={adminDisplayName}
          setAdminDisplayName={setAdminDisplayName}
          email={email}
          setEmail={setEmail}
          onBack={() => setStep(1)}
          onNext={nextFromAdmin}
        />
      ) : null}

      {step === 3 ? (
        <>
          <AuthCaptchaBlock
            captchaCode={captchaCode}
            onCodeChange={setCaptchaCode}
            onChallenge={setCaptchaId}
            onAvailability={setCaptchaOn}
            fieldError={fieldError}
          />
          <div className="cert-auth-form">
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
              <button type="button" className="btn-ghost" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                type="button"
                className="btn-primary qrp-auth-submit auth-cta"
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? 'Creating organization…' : 'Create organization'}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </AuthPanel>
  )
}

function RequestOrgStep({
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
    <div className="cert-auth-form">
      <fieldset>
        <legend className="mb-2 block w-full text-center text-sm font-semibold text-foreground">
          Organization type
        </legend>
        <div className="cert-org-kind-grid">
          {ORG_KINDS.map(({ id, label }) => (
            <label
              key={id}
              className={`cert-org-kind-option${orgKind === id ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name="org_kind"
                checked={orgKind === id}
                onChange={() => setOrgKind(id)}
              />
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
      <button type="button" className="btn-primary qrp-auth-submit auth-cta w-full" onClick={onNext}>
        Continue
      </button>
    </div>
  )
}

function AdminStep({
  adminUsername,
  setAdminUsername,
  adminDisplayName,
  setAdminDisplayName,
  email,
  setEmail,
  onBack,
  onNext,
}: {
  adminUsername: string
  setAdminUsername: (v: string) => void
  adminDisplayName: string
  setAdminDisplayName: (v: string) => void
  email: string
  setEmail: (v: string) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="cert-auth-form">
      <p className="cert-auth-prose">
        This person becomes the organization administrator: invite members, assign roles, and configure access.
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
      <div className="cert-auth-actions">
        <button type="button" className="btn-ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn-primary qrp-auth-submit auth-cta" onClick={onNext}>
          Continue
        </button>
      </div>
    </div>
  )
}