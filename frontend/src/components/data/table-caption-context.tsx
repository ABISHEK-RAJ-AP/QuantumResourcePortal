import { createContext, useContext, type ReactNode } from 'react'

const TableCaptionContext = createContext<string | null>(null)

export function TableCaptionProvider({ title, children }: { title: string; children: ReactNode }) {
  return <TableCaptionContext.Provider value={title}>{children}</TableCaptionContext.Provider>
}

export function useNearestTableCaption() {
  return useContext(TableCaptionContext)
}