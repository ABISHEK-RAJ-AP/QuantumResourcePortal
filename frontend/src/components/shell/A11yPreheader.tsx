import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Accessibility,
  CircleDot,
  Eye,
  Languages,
  Link2,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Sun,
  X,
} from 'lucide-react'

import {
  A11Y_DEFAULTS,
  applyA11ySettings,
  getUiLangLabel,
  loadA11yPrefs,
  loadUiLang,
  saveA11yPrefs,
  saveUiLang,
  UI_LANGUAGES,
  type A11yPrefs,
} from '@/lib/a11y'
import { cn } from '@/lib/utils'

function A11yBtn({
  label,
  icon,
  onClick,
  active,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition',
        active
          ? 'border-primary bg-accent text-accent-foreground'
          : 'border-border bg-card text-foreground hover:bg-accent',
      )}
    >
      <span className="text-foreground">{icon}</span>
      {label}
    </button>
  )
}

function A11yPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: A11yPrefs
  onChange: (next: A11yPrefs) => void
  onClose: () => void
}) {
  const set = (key: keyof A11yPrefs, val: A11yPrefs[keyof A11yPrefs]) => {
    let next = { ...settings, [key]: val } as A11yPrefs
    if (key === 'pauseAnim' && val) next = { ...next, disableWebGLBackground: true }
    applyA11ySettings(next)
    saveA11yPrefs(next)
    onChange(next)
  }

  const resetAll = () => {
    const next = { ...A11Y_DEFAULTS }
    applyA11ySettings(next)
    saveA11yPrefs(next)
    onChange(next)
  }

  return (
    <div
      className="absolute top-[calc(100%+8px)] right-0 z-[9200] max-h-[80vh] w-[min(360px,calc(100vw-16px))] overflow-y-auto rounded-xl border border-border bg-card p-4 text-foreground shadow-raised"
      role="dialog"
      aria-label="Accessibility options"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Accessibility className="size-4" />
          Accessibility
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="text-[11px] font-bold text-primary hover:underline" onClick={resetAll}>
            Reset all
          </button>
          <button type="button" className="rounded-md p-1 hover:bg-accent" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
      </div>

      <p className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">Contrast</p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <A11yBtn label="High contrast" icon={<Moon size={18} />} active={settings.contrast === 'high'} onClick={() => set('contrast', settings.contrast === 'high' ? 'normal' : 'high')} />
        <A11yBtn label="Grayscale" icon={<CircleDot size={18} />} active={settings.contrast === 'gray'} onClick={() => set('contrast', settings.contrast === 'gray' ? 'normal' : 'gray')} />
        <A11yBtn label="Normal" icon={<Sun size={18} />} active={settings.contrast === 'normal'} onClick={() => set('contrast', 'normal')} />
        <A11yBtn label="Pause animation" icon={<RotateCcw size={18} />} active={settings.pauseAnim} onClick={() => set('pauseAnim', !settings.pauseAnim)} />
      </div>

      <p className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">Text — {settings.fontSize}%</p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <A11yBtn label="Bigger" icon={<Plus size={18} />} active={settings.fontSize > 100} onClick={() => set('fontSize', Math.min(settings.fontSize + 10, 170))} />
        <A11yBtn label="Smaller" icon={<Minus size={18} />} active={settings.fontSize < 100} onClick={() => set('fontSize', Math.max(settings.fontSize - 10, 80))} />
        <A11yBtn label="Text spacing" icon={<Link2 size={18} />} active={settings.textSpacing} onClick={() => set('textSpacing', !settings.textSpacing)} />
        <A11yBtn label="Line height" icon={<Eye size={18} />} active={settings.lineHeight} onClick={() => set('lineHeight', !settings.lineHeight)} />
      </div>

      <p className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">Reading</p>
      <div className="grid grid-cols-2 gap-2">
        <A11yBtn label="Dyslexia font" icon={<Eye size={18} />} active={settings.dyslexia} onClick={() => set('dyslexia', !settings.dyslexia)} />
        <A11yBtn label="Focus mode" icon={<Eye size={18} />} active={settings.focusMode} onClick={() => set('focusMode', !settings.focusMode)} />
        <A11yBtn label="Big cursor" icon={<CircleDot size={18} />} active={settings.bigCursor} onClick={() => set('bigCursor', !settings.bigCursor)} />
        <A11yBtn label="Highlight links" icon={<Link2 size={18} />} active={settings.highlightLinks} onClick={() => set('highlightLinks', !settings.highlightLinks)} />
        <A11yBtn label="Hide images" icon={<Eye size={18} />} active={settings.hideImages} onClick={() => set('hideImages', !settings.hideImages)} />
        <A11yBtn
          label="Disable 3D bg"
          icon={<RotateCcw size={18} />}
          active={settings.disableWebGLBackground}
          onClick={() => set('disableWebGLBackground', !settings.disableWebGLBackground)}
        />
      </div>
    </div>
  )
}

function LangPanel({ current, onClose, onSelect }: { current: string; onClose: () => void; onSelect: (code: string) => void }) {
  return (
    <div
      className="absolute top-[calc(100%+8px)] right-0 z-[9200] max-h-[360px] w-[min(260px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-border bg-card p-3 text-foreground shadow-raised"
      role="dialog"
      aria-label="Language"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold">Language</span>
        <button type="button" className="rounded-md p-1 hover:bg-accent" aria-label="Close" onClick={onClose}>
          <X className="size-4" />
        </button>
      </div>
      <ul className="space-y-1">
        {UI_LANGUAGES.map((lang) => (
          <li key={lang.code}>
            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition hover:bg-accent',
                current === lang.code && 'bg-accent text-accent-foreground',
              )}
              onClick={() => onSelect(lang.code)}
            >
              <span>{lang.label}</span>
              <span className="text-xs text-muted-foreground">{lang.englishLabel}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Cert Studio / Q-TeleScope accessibility toolbar above the public header. */
export function A11yPreheader() {
  const barRef = useRef<HTMLDivElement>(null)
  const [openPanel, setOpenPanel] = useState<'access' | 'lang' | null>(null)
  const [lang, setLang] = useState(() => loadUiLang())
  const [a11ySettings, setA11ySettings] = useState(() => loadA11yPrefs())

  useEffect(() => {
    applyA11ySettings(a11ySettings)
  }, [a11ySettings])

  useEffect(() => {
    const onLang = () => setLang(loadUiLang())
    const onA11y = () => setA11ySettings(loadA11yPrefs())
    window.addEventListener('qrp-lang-changed', onLang)
    window.addEventListener('qrp-a11y-changed', onA11y)
    return () => {
      window.removeEventListener('qrp-lang-changed', onLang)
      window.removeEventListener('qrp-a11y-changed', onA11y)
    }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenPanel(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSkipToMain = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const target = document.getElementById('page-content') || document.getElementById('main-content')
    if (!target) return
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    window.setTimeout(() => target.focus({ preventScroll: true }), reduced ? 0 : 350)
  }, [])

  const toggle = (name: 'access' | 'lang') => setOpenPanel((p) => (p === name ? null : name))

  return (
    <div
      ref={barRef}
      className="a11y-preheader notranslate sticky top-0 z-[5000] flex h-8 shrink-0 items-center justify-end overflow-visible border-b border-white/15 bg-[#0a192f] text-[12px] text-white/90"
      role="toolbar"
      aria-label="Accessibility options"
      translate="no"
    >
      <a
        href="#page-content"
        className="mr-auto inline-flex h-8 items-center border-r border-white/15 px-3 font-semibold text-white/90 hover:bg-white/10 hover:text-amber-200"
        onClick={handleSkipToMain}
      >
        Skip to main content
      </a>
      <div className="relative flex items-stretch">
        <div className="relative flex items-center">
          <button
            type="button"
            className="inline-flex h-8 min-w-10 items-center justify-center border-l border-white/15 px-2.5 text-white/85 hover:bg-white/10 hover:text-amber-200"
            aria-label="Accessibility settings"
            aria-expanded={openPanel === 'access'}
            title="Accessibility settings"
            onClick={() => toggle('access')}
          >
            <Accessibility size={15} strokeWidth={2} aria-hidden />
          </button>
          {openPanel === 'access' && (
            <A11yPanel settings={a11ySettings} onChange={setA11ySettings} onClose={() => setOpenPanel(null)} />
          )}
        </div>
        <div className="relative flex items-center">
          <button
            type="button"
            className="inline-flex h-8 min-w-10 items-center justify-center gap-1 border-l border-white/15 px-2.5 font-semibold text-white/85 hover:bg-white/10 hover:text-amber-200"
            aria-label={`Language: ${getUiLangLabel(lang)}`}
            aria-expanded={openPanel === 'lang'}
            title={`Language: ${getUiLangLabel(lang)}`}
            onClick={() => toggle('lang')}
          >
            <Languages size={15} strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">{getUiLangLabel(lang)}</span>
          </button>
          {openPanel === 'lang' && (
            <LangPanel
              current={lang}
              onClose={() => setOpenPanel(null)}
              onSelect={(code) => {
                saveUiLang(code)
                setLang(code)
                setOpenPanel(null)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
