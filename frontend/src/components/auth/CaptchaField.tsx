import { useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'

import { authFetch } from '@/api/qre'
import { cn } from '@/lib/utils'

type CaptchaPayload = {
  captcha_id: string
  captcha_image: string
}

/**
 * Image challenge when the API exposes GET /auth/captcha (e.g. TeleScope, or QRP with
 * QRE_CAPTCHA_ENABLED). If the endpoint is missing, renders nothing and clears the challenge.
 */
export function CaptchaField({
  value,
  onChange,
  onChallenge,
  onAvailability,
  className,
}: {
  value: string
  onChange: (code: string) => void
  onChallenge: (id: string) => void
  onAvailability?: (available: boolean) => void
  className?: string
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

  // Probe quietly: hide until the API actually serves a challenge (QRP lab has captcha off).
  if (!available) return null

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium" htmlFor="login-captcha">
          Image verification
        </label>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RotateCw className={cn('size-3', loading && 'animate-spin')} aria-hidden />
          New image
        </button>
      </div>
      <div className="flex items-stretch gap-3">
        <div className="flex h-[72px] w-[200px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
          {loading ? (
            <span className="text-xs text-muted-foreground">Generating…</span>
          ) : image ? (
            <img
              src={image}
              alt="Enter the characters shown"
              className="h-full w-full object-contain select-none"
              draggable={false}
            />
          ) : (
            <span className="px-2 text-center text-xs text-muted-foreground">Challenge offline</span>
          )}
        </div>
        <input
          id="login-captcha"
          required
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          placeholder="Characters shown"
          className="field-input min-w-0 flex-1 self-center"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, ''))}
        />
      </div>
      {error ? <p className="text-xs text-critical">{error}</p> : null}
    </div>
  )
}
