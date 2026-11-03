export const A11Y_STORAGE_KEY = 'qrp_a11y'
export const LANG_STORAGE_KEY = 'qrp_lang'

export type A11yPrefs = {
  contrast: 'normal' | 'high' | 'gray'
  fontSize: number
  textSpacing: boolean
  lineHeight: boolean
  dyslexia: boolean
  focusMode: boolean
  pauseAnim: boolean
  bigCursor: boolean
  highlightLinks: boolean
  hideImages: boolean
  disableWebGLBackground: boolean
}

export const A11Y_DEFAULTS: A11yPrefs = {
  contrast: 'normal',
  fontSize: 100,
  textSpacing: false,
  lineHeight: false,
  dyslexia: false,
  focusMode: false,
  pauseAnim: false,
  bigCursor: false,
  highlightLinks: false,
  hideImages: false,
  disableWebGLBackground: false,
}

export const UI_LANGUAGES = [
  { code: 'en', label: 'English', englishLabel: 'English' },
  { code: 'hi', label: 'हिन्दी', englishLabel: 'Hindi' },
  { code: 'ta', label: 'தமிழ்', englishLabel: 'Tamil' },
  { code: 'te', label: 'తెలుగు', englishLabel: 'Telugu' },
  { code: 'bn', label: 'বাংলা', englishLabel: 'Bengali' },
  { code: 'mr', label: 'मराठी', englishLabel: 'Marathi' },
]

export function loadA11yPrefs(): A11yPrefs {
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY)
    if (!raw) return { ...A11Y_DEFAULTS }
    return { ...A11Y_DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...A11Y_DEFAULTS }
  }
}

export function saveA11yPrefs(settings: A11yPrefs) {
  try {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('qrp-a11y-changed', { detail: settings }))
}

export function loadUiLang() {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) || 'en'
  } catch {
    return 'en'
  }
}

export function saveUiLang(code: string) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, code)
    window.dispatchEvent(new CustomEvent('qrp-lang-changed', { detail: { code } }))
  } catch {
    /* ignore */
  }
}

export function getUiLangLabel(code: string) {
  const lang = UI_LANGUAGES.find((l) => l.code === code)
  if (!lang) return 'Language'
  return lang.code === 'en' ? lang.label : lang.englishLabel
}

export function applyA11ySettings(settings: A11yPrefs) {
  const s = { ...A11Y_DEFAULTS, ...settings }
  const { body, documentElement: html } = document
  const scale = Math.min(170, Math.max(80, Number(s.fontSize) || 100)) / 100
  html.style.setProperty('--font-scale', String(scale))
  html.style.fontSize = `${scale * 100}%`

  const systemReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const reduceMotion = Boolean(s.pauseAnim) || systemReduce
  body.classList.toggle('a11y-pause-anim', reduceMotion)
  body.classList.toggle('a11y-focus-mode', Boolean(s.focusMode))
  body.classList.toggle('a11y-big-cursor', Boolean(s.bigCursor))
  body.classList.toggle('a11y-links', Boolean(s.highlightLinks))
  body.classList.toggle('a11y-dyslexia', Boolean(s.dyslexia))
  body.classList.toggle('a11y-text-spacing', Boolean(s.textSpacing))
  body.classList.toggle('a11y-line-height', Boolean(s.lineHeight))
  body.classList.toggle('a11y-hide-images', Boolean(s.hideImages))
  body.classList.toggle('a11y-high-contrast', s.contrast === 'high')
  body.classList.toggle('a11y-grayscale', s.contrast === 'gray')
  body.dataset.disableWebgl = s.disableWebGLBackground || reduceMotion ? '1' : '0'
}

export function initA11yFromStorage() {
  applyA11ySettings(loadA11yPrefs())
}
