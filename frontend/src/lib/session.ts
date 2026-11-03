export type SessionUser = {
  username: string
  role: string
  email?: string
  full_name?: string
  org?: string
  token: string
}

const TOKEN_KEY = 'qrp_token'
const USER_KEY = 'qrp_user'
const ROLE_KEY = 'qre_role'
const NAME_KEY = 'qre_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getSessionUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

export function setSession(user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, user.token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  localStorage.setItem(ROLE_KEY, user.role)
  localStorage.setItem(NAME_KEY, user.username)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function isSignedIn() {
  return Boolean(getToken() && getSessionUser())
}
