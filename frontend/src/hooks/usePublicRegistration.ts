import { useQuery } from '@tanstack/react-query'

import { authCapabilitiesKey, fetchAuthCapabilities } from '@/api/authCapabilities'

/** Whether public organisation registration is open (TeleScope /register gate). */
export function usePublicRegistration() {
  const caps = useQuery({
    queryKey: authCapabilitiesKey,
    queryFn: fetchAuthCapabilities,
    staleTime: 60_000,
  })
  const allowed =
    caps.isPending || caps.isError
      ? true
      : Boolean(caps.data?.organization_registration ?? caps.data?.self_registration)
  return { allowed, loaded: caps.isSuccess || caps.isError }
}