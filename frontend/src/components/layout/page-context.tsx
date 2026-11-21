import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { Crumb } from '@/components/layout/Breadcrumbs'

export type PageChrome = {
  eyebrow?: string
  title?: string
  description?: string
  /** Longer guidance — shown in header InfoTip, not as a subtitle paragraph. */
  descriptionHelp?: ReactNode
  crumbs?: Crumb[]
  /** Query refresh time — rendered once in the app header, not in page body. */
  updatedAt?: number
  /** Primary page actions (centred in shell header — TeleScope-style). */
  actions?: ReactNode
  /** Nested panels (e.g. Health inside Settings) must not overwrite shell chrome. */
  skip?: boolean
}

type PageChromeApi = {
  chrome: PageChrome
  setChrome: (next: PageChrome) => void
}

const PageChromeContext = createContext<PageChromeApi | null>(null)

export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<PageChrome>({})
  const value = useMemo(() => ({ chrome, setChrome }), [chrome])
  return <PageChromeContext.Provider value={value}>{children}</PageChromeContext.Provider>
}

export function usePageChrome() {
  const ctx = useContext(PageChromeContext)
  if (!ctx) throw new Error('usePageChrome requires PageChromeProvider')
  return ctx
}

/** Workspace shell title when inside provider; otherwise undefined (public routes). */
export function useOptionalPageChromeTitle() {
  const ctx = useContext(PageChromeContext)
  return ctx?.chrome.title
}

/** Publishes title/description/freshness into the app header. No-op outside the shell provider. */
export function useSetPageChrome({
  eyebrow,
  title,
  description,
  descriptionHelp,
  crumbs,
  updatedAt,
  actions,
  skip,
}: PageChrome) {
  const ctx = useContext(PageChromeContext)
  const setChrome = ctx?.setChrome
  const crumbKey = crumbs?.map((c) => `${c.label}:${c.to ?? ''}`).join('|') ?? ''
  useEffect(() => {
    if (!setChrome || skip) return
    setChrome({ eyebrow, title, description, descriptionHelp, crumbs, updatedAt, actions })
    return () => setChrome({})
    // crumbs serialized via crumbKey to avoid identity churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eyebrow, title, description, descriptionHelp, crumbKey, updatedAt, actions, skip, setChrome])
}
