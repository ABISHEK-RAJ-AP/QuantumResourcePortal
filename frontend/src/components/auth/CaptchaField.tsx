import { useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'

import { authFetch } from '@/api/qre'
import { cn } from '@/lib/utils'

type CaptchaPayload = {
  captcha_id: string
  captcha_image: string
}

/**
 * Image challenge when the API exposes GET /auth/captcha (QRE_CAPTCHA_ENABLED).
 * If the endpoint is missing, renders nothing and clears the challenge.
 */
export function CaptchaField({
  value,
  onChange,
  onChallenge,
  onAvailability,
  className,
  showWhenDisabled = false,
}: {
  value: string
  onChange: (code: string) => void
  onChallenge: (id: string) => void
  onAvailability?: (available: boolean) => void
  className?: string
  /** When true, show offline state instead of hiding (auth pages expect captcha on). */
  showWhenDisabled?: boolean
}) {
  const [image, setImage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [available, setAvailable] = useState(false)

  async function refresh() {
    setLoading(true)
    setError('')
    onChange('')
    try {
      const data = await authFetch<CaptchaPayload>('/auth/captcha')
      setImage(data.captcha_image)
      onChallenge(data.captcha_id)
      setAvailable(true)
      onAvailability?.(true)
    } catch {
      setImage('')
      onChallenge('')
      setAvailable(false)
      onAvailability?.(false)
      setError('')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // ponytail: mount-only challenge probe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!available && !showWhenDisabled) return null

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-base font-medium" htmlFor="login-captcha">
          Image verification
        </label>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RotateCw className={cn('size-3', loading && 'animate-spin')} aria-hidden />
          New image
        </button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="flex h-[5.5rem] w-full max-w-[17rem] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40 sm:w-[17rem]">
          {loading ? (
            <span className="text-sm text-muted-foreground">Generating…</span>
          ) : image ? (
            <img
              src={image}
              alt="Enter the characters shown"
              className="h-full w-full object-contain select-none"
              draggable={false}
            />
          ) : (
            <span className="px-3 text-center text-sm text-muted-foreground">
              Server captcha off — set QRE_CAPTCHA_ENABLED on API
            </span>
          )}
        </div>
        <input
          id="login-captcha"
          required={available}
          disabled={!available}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          placeholder="Characters shown"
          className="field-input qrp-auth-input min-w-0 flex-1 self-center"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, ''))}
        />
      </div>
      {error ? <p className="text-xs text-critical">{error}</p> : null}
    </div>
  )
}
