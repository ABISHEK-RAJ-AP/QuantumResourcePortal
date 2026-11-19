import { apiRequest } from '@/api/client'

const BASE = '/api/v1'

export type RegisterOrganizationBody = {
  tenant_code: string
  tenant_name: string
  admin_username: string
  admin_display_name: string
  email?: string
  password: string
  confirm_password: string
  org_kind?: string
  captcha_id?: string
  captcha_code?: string
}

export type RegisterOrganizationResult = {
  status: string
  tenant_id: string
  tenant_code: string
  admin_username: string
  created_tenant: boolean
}

export function registerOrganization(body: RegisterOrganizationBody) {
  return apiRequest<RegisterOrganizationResult>(`${BASE}/auth/register-organization`, {
    method: 'POST',
    json: body,
  }).then((r) => r.data)
}