import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import { AppProviders } from '@/app/providers'
import { router } from '@/app/router'
import { initA11yFromStorage } from '@/lib/a11y'
import { initTheme } from '@/lib/theme'
import '@/styles/index.css'

initTheme()
initA11yFromStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
