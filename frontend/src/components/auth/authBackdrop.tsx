import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type AuthBackdropFields = {
  username: string
  password: string
  captchaInput: string
  captchaCode: string
}

const defaultFields: AuthBackdropFields = {
  username: '',
  password: '',
  captchaInput: '',
  captchaCode: '',
}

type AuthBackdropContextValue = {
  fields: AuthBackdropFields
  patchFields: (partial: Partial<AuthBackdropFields>) => void
}

const AuthBackdropContext = createContext<AuthBackdropContextValue | null>(null)

export function AuthBackdropProvider({ children }: { children: ReactNode }) {
  const [fields, setFields] = useState<AuthBackdropFields>(defaultFields)
  const patchFields = (partial: Partial<AuthBackdropFields>) => {
    setFields((prev) => ({ ...prev, ...partial }))
  }
  return <AuthBackdropContext value={{ fields, patchFields }}>{children}</AuthBackdropContext>
}

/** Sync login/register inputs to the Cert wire backdrop animation. */
export function useAuthBackdrop(): AuthBackdropContextValue {
  const ctx = useContext(AuthBackdropContext)
  if (!ctx) {
    return { fields: defaultFields, patchFields: () => {} }
  }
  return ctx
}

/** Mount inside AuthPanel to drive wire animation from form state. */
export function AuthBackdropSync({
  username = '',
  password = '',
  captchaInput = '',
}: Partial<Pick<AuthBackdropFields, 'username' | 'password' | 'captchaInput'>>) {
  const { patchFields } = useAuthBackdrop()
  useEffect(() => {
    patchFields({
      username,
      password,
      captchaInput,
      captchaCode: captchaInput ? 'AAAA' : '',
    })
  }, [captchaInput, password, patchFields, username])
  return null
}