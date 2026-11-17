/** Lab/on by default; set `VITE_QRE_CAPTCHA=0` to hide fields in the SPA. */
export function isAuthCaptchaEnabled(): boolean {
  const flag = import.meta.env.VITE_QRE_CAPTCHA
  if (flag === '0' || flag === 'false') return false
  return flag === '1' || flag === 'true' || import.meta.env.VITE_QRE_ENV === 'lab'
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
  if (!active) return 'Image verification is required but the server challenge is unavailable.'
  if (!captchaCode.trim()) return 'Enter the characters shown in the image.'
  return null
}