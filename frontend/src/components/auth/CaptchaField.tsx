import { useCallback, useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'

import { ApiError } from '@/api/client'
import { authFetch } from '@/api/qre'
import { AuthOutlineField, authOutlineControlClass } from '@/components/auth/AuthOutlineField'
import { enrichApiFailure } from '@/lib/apiReachability'
import { cn } from '@/lib/utils'

type CaptchaPayload = {
  captcha_id: string
  captcha_image: string
}

function normalizeCaptchaSrc(raw: string): string {
  if (!raw) return ''
  if (raw.startsWith('data:')) return raw
  if (raw.trim().startsWith('<svg')) {
    try {
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(raw)))}`
    } catch {
      return raw
    }
  }
  return raw
}

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
  showWhenDisabled?: boolean
}) {
  const [image, setImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [available, setAvailable] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    onChange('')
    try {
      const data = await authFetch<CaptchaPayload>('/auth/captcha')
      const src = normalizeCaptchaSrc(data.captcha_image)
      if (!data.captcha_id || !src) throw new Error('empty challenge')
      setImage(src)
      onChallenge(data.captcha_id)
      setAvailable(true)
      onAvailability?.(true)
    } catch (err) {
      setImage('')
      onChallenge('')
      setAvailable(false)
      onAvailability?.(false)
      const resolved = enrichApiFailure(err)
      if (resolved instanceof ApiError) {
        setError(resolved.detail || 'Could not load verification image.')
      } else {
        setError(resolved.message || 'Could not load verification image.')
      }
    } finally {
      setLoading(false)
    }
  }, [onAvailability, onChallenge, onChange])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!showWhenDisabled && !available && !loading && !error) return null

  return (
    <div className={cn('captcha-field', className)}>
      <div className="captcha-field__head">
        <span className="captcha-field__legend" id="auth-captcha-legend">
          Security check
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="captcha-field__refresh"
          aria-label="New image"
        >
          <RotateCw className={cn('size-4', loading && 'animate-spin')} aria-hidden />
          <span className="captcha-field__refresh-label">New image</span>
        </button>
      </div>
      <div className="captcha-field__row" role="group" aria-labelledby="auth-captcha-legend">
        <div className="captcha-field__image" aria-live="polite">
          {loading ? (
            <span className="captcha-field__placeholder">Generating…</span>
          ) : image ? (
            <img
              src={image}
              alt="Enter the characters shown"
              className="captcha-field__img"
              width={180}
              height={72}
              draggable={false}
              onError={() => {
                setError('Image failed to render. Click New image.')
                setImage('')
              }}
            />
          ) : (
            <button type="button" className="captcha-field__placeholder underline" onClick={() => void refresh()}>
              Retry load
            </button>
          )}
        </div>
        <AuthOutlineField label="Characters" htmlFor="login-captcha" className="captcha-field__input auth-outline-field--flush">
          <input
            id="login-captcha"
            required={available}
            disabled={!available}
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={12}
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\s/g, '').toUpperCase())}
            className={`${authOutlineControlClass} captcha-field__control font-mono text-lg tracking-widest tabular-nums uppercase`}
            aria-invalid={Boolean(error)}
          />
        </AuthOutlineField>
      </div>
      <p className="captcha-field__help">Type the characters from the image.</p>
      {error ? (
        <p className="captcha-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}