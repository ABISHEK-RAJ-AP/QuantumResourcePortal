/** Lab-only actions (seed demo, quick dock load) — hidden in production builds. */
export const demoActionsAllowed = import.meta.env.VITE_QRE_ENV !== 'production'