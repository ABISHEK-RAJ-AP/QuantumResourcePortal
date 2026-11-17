import { CaptchaField } from '@/components/auth/CaptchaField'
import { FieldAlert } from '@/components/auth/FormAlerts'
import { isAuthCaptchaEnabled } from '@/lib/authCaptcha'

/** Standard captcha slot for login, register, reset, MFA. */
export function AuthCaptchaBlock({
  captchaCode,
  onCodeChange,
  onChallenge,
  onAvailability,
  fieldError,
}: {
  captchaCode: string
  onCodeChange: (code: string) => void
  onChallenge: (id: string) => void
  onAvailability: (available: boolean) => void
  fieldError?: string
}) {
  if (!isAuthCaptchaEnabled()) return null
  return (
    <div className="qrp-auth-captcha">
      <CaptchaField
        value={captchaCode}
        onChange={onCodeChange}
        onChallenge={onChallenge}
        onAvailability={onAvailability}
        showWhenDisabled
      />
      <FieldAlert message={fieldError} />
    </div>
  )
}