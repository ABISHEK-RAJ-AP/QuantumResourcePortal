/** SPA preference — off in production builds unless `VITE_QRE_CAPTCHA=1`; on in lab/dev by default. */
export function isAuthCaptchaEnabled(): boolean {
  if (import.meta.env.VITE_QRE_ENV === 'production') {
    const flag = import.meta.env.VITE_QRE_CAPTCHA
    return flag === '1' || flag === 'true'
  }
  const flag = import.meta.env.VITE_QRE_CAPTCHA
  if (flag === '0' || flag === 'false') return false
  return true
}

export type CaptchaPayload = {
  captcha_id: string
  captcha_code: string
}

export function buildCaptchaPayload(
  enabled: boolean,
  active: boolean,
  captchaId: string,
  captchaCode: string,
): CaptchaPayload | undefined {
  if (!enabled || !active || !captchaId || !captchaCode.trim()) return undefined
  return { captcha_id: captchaId, captcha_code: captchaCode.trim() }
}

export function validateCaptchaBeforeSubmit(
  enabled: boolean,
  active: boolean,
  captchaCode: string,
): string | null {
  if (!enabled) return null
  if (!active) return 'Image verification is not ready yet. Wait for the image or use New image.'
  if (!captchaCode.trim()) return 'Enter the characters shown in the image.'
  return null
}