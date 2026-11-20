import { CaptchaField } from '@/components/auth/CaptchaField'
import { FieldAlert } from '@/components/auth/FormAlerts'
import { useAuthCaptchaRequired } from '@/hooks/useAuthCaptchaRequired'

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
  const required = useAuthCaptchaRequired()
  if (!required) return null
  return (
    <div className="qrp-auth-captcha">
      <CaptchaField
        value={captchaCode}
        onChange={onCodeChange}
        onChallenge={onChallenge}
        onAvailability={onAvailability}
      />
      <FieldAlert message={fieldError} />
    </div>
  )
}