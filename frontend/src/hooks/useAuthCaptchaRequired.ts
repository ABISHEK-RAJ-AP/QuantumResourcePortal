import { useQuery } from '@tanstack/react-query'

import { authCapabilitiesKey, fetchAuthCapabilities } from '@/api/authCapabilities'
import { isAuthCaptchaEnabled } from '@/lib/authCaptcha'

/** True when SPA or live API says login CAPTCHA is required. */
export function useAuthCaptchaRequired(): boolean {
  const caps = useQuery({
    queryKey: authCapabilitiesKey,
    queryFn: fetchAuthCapabilities,
    retry: 1,
    staleTime: 60_000,
  })
  return isAuthCaptchaEnabled() || caps.data?.captcha_enabled === true
}