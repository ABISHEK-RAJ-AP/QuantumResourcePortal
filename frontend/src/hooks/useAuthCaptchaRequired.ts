import { useQuery } from '@tanstack/react-query'

import { authCapabilitiesKey, fetchAuthCapabilities } from '@/api/authCapabilities'
import { isAuthCaptchaEnabled } from '@/lib/authCaptcha'

/** True only when SPA opts in AND API reports captcha enabled (lab: keep VITE_QRE_CAPTCHA=0). */
export function useAuthCaptchaRequired(): boolean {
  const viteOn = isAuthCaptchaEnabled()
  if (!viteOn) return false

  const caps = useQuery({
    queryKey: authCapabilitiesKey,
    queryFn: fetchAuthCapabilities,
    retry: 1,
    staleTime: 60_000,
  })

  if (!caps.isSuccess) return false
  return caps.data.captcha_enabled === true
}