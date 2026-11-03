import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge class names; later Tailwind utilities win over earlier conflicting ones (shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
