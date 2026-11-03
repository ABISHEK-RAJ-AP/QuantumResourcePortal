import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type PageChrome = {
  eyebrow?: string
  title?: string
  description?: string
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

/** Publishes title/description into the app header. No-op outside the shell provider. */
export function useSetPageChrome({ eyebrow, title, description }: PageChrome) {
  const ctx = useContext(PageChromeContext)
  const setChrome = ctx?.setChrome
  useEffect(() => {
    if (!setChrome) return
    setChrome({ eyebrow, title, description })
    return () => setChrome({})
  }, [eyebrow, title, description, setChrome])
}
