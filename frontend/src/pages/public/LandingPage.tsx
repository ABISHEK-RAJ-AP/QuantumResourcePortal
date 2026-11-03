import { useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  ChevronDown,
  ClipboardCheck,
  Gauge,
  Server,
  Shield,
  ScrollText,
  Users,
} from 'lucide-react'

import { PublicShell } from '@/components/marketing/PublicShell'
import { CubeWaveHero } from '@/components/ui/cube-wave-hero'
import { HoverGrid } from '@/components/ui/hover-grid'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

const CAPABILITIES = [
  {
    icon: Shield,
    title: 'Govern workloads',
    body: 'Multi-stage approvals, quotas, and policy trails without inventing missing evidence.',
  },
  {
    icon: Server,
    title: 'Operate the fleet',
    body: 'Backends, queues, incidents, and jobs in one workspace for the active institution.',
  },
  {
    icon: ScrollText,
    title: 'Keep an audit trail',
    body: 'Reservations, metering, evidence snapshots, and activity stay readable for review.',
  },
]

const MODULES = [
  { icon: ClipboardCheck, title: 'Approvals', body: 'Policy-driven stage trail with quota checks before decide.' },
  { icon: Gauge, title: 'Quotas & metering', body: 'Daily shot ledger, headroom, and connector rollups.' },
  { icon: Server, title: 'Inventory & pools', body: 'Register assets, virtual pools, and provider manifests.' },
  { icon: Users, title: 'Projects & users', body: 'Project membership and role directory for operators.' },
  { icon: Shield, title: 'Reconciliation', body: 'G3 attempt ledger for authorise and reconcile outcomes.' },
  { icon: ScrollText, title: 'Evidence & audit', body: 'Append-only governance events and capture snapshots.' },
]

const WORKFLOW = [
  { n: '01', title: 'Submit', body: 'Create a workload package from a project and submit for review.' },
  { n: '02', title: 'Review', body: 'Technical and operations stages follow the published policy.' },
  { n: '03', title: 'Authorise', body: 'Quota passes and decisions move the request forward.' },
  { n: '04', title: 'Reconcile', body: 'Dispatch attempts and outcomes stay on the audit trail.' },
]

const FAQ = [
  {
    q: 'What is the Quantum Resource Portal?',
    a: 'C-DAC’s governance workspace for quantum workloads — approvals, capacity, operations, and evidence for the active institution.',
  },
  {
    q: 'How do I start a demo review?',
    a: 'Sign in as admin, open Approvals, and use Start demo review. That creates a submission and opens the stage trail.',
  },
  {
    q: 'Is procurement included?',
    a: 'No. Procurement and entitlements writes stay out of this release. Use inventory and the quota ledger for live capacity controls.',
  },
]

export function LandingPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [openFaq, setOpenFaq] = useState(0)

  return (
    <PublicShell>
      {/* Full-bleed hero — CubeWave edge-to-edge (Cert Studio), not boxed */}
      <section
        className={cn(
          'relative isolate w-full min-h-[calc(100svh-7.5rem)] overflow-hidden',
          dark ? 'bg-[#0b1220]' : 'bg-surface',
        )}
      >
        <CubeWaveHero />
        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-[1]',
            dark
              ? 'bg-gradient-to-b from-[#0b1220]/25 via-transparent to-[#0b1220]'
              : 'bg-gradient-to-b from-surface/30 via-transparent to-surface',
          )}
          aria-hidden
        />
        <div className="relative z-10 flex min-h-[calc(100svh-7.5rem)] flex-col items-center justify-center px-4 py-16 sm:px-8 lg:px-10">
          <div
            className={cn(
              'fade-up pointer-events-auto mx-auto w-full max-w-3xl rounded-2xl border px-6 py-10 text-center backdrop-blur-xl sm:px-10 sm:py-12',
              dark
                ? 'border-white/15 bg-[#0b1220]/75 shadow-2xl shadow-black/40'
                : 'border-border/70 bg-white/75 shadow-raised',
            )}
          >
            <p className={cn('mb-3 text-xs font-bold tracking-[0.2em] uppercase', dark ? 'text-cyan-300' : 'text-info-text')}>
              Centre for Development of Advanced Computing
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Quantum Resource Portal
            </h1>
            <p className={cn('mt-4 text-pretty text-base sm:text-lg', dark ? 'text-white/70' : 'text-muted-foreground')}>
              Institution-wide governance for quantum workloads — approvals, capacity, operations, and evidence in one
              place.
            </p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to="/login" className="btn-primary w-full gap-2 px-6 py-3 text-base shadow-lg shadow-primary/25 sm:w-auto sm:min-w-[160px]">
                Enter portal
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/register"
                className={cn(
                  'inline-flex w-full items-center justify-center rounded-xl border px-6 py-3 text-base font-semibold sm:w-auto sm:min-w-[160px]',
                  dark ? 'border-white/20 bg-white/5 hover:bg-white/10' : 'border-border bg-card hover:bg-accent',
                )}
              >
                Request access
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="relative z-20 mx-auto w-full max-w-7xl space-y-24 px-4 py-20 sm:px-8 lg:px-10">
        <section id="capabilities" className="scroll-mt-28">
          <div
            className={cn(
              'flex flex-col justify-between gap-6 border-b pb-4 md:flex-row md:items-end',
              dark ? 'border-white/10' : 'border-border',
            )}
          >
            <div>
              <span className={cn('text-xs font-bold tracking-wider uppercase', dark ? 'text-cyan-300' : 'text-info-text')}>
                Core governance
              </span>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Control beyond a single monitoring app</h2>
            </div>
            <p className={cn('max-w-md text-sm leading-relaxed', dark ? 'text-white/60' : 'text-muted-foreground')}>
              Approvals, capacity, fleet posture, and evidence for the active tenant — aligned to G1–G3.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {CAPABILITIES.map((item) => {
              const Icon = item.icon
              return (
                <article
                  key={item.title}
                  className={cn(
                    'feature-card group relative overflow-hidden rounded-2xl border p-6',
                    dark ? 'border-white/10 bg-white/[0.03]' : 'border-border bg-card shadow-card',
                  )}
                >
                  <HoverGrid className="opacity-0 transition-opacity duration-300 group-hover:opacity-100" density={36} />
                  <div className="relative z-[1]">
                    <span
                      className={cn(
                        'inline-flex size-11 items-center justify-center rounded-xl',
                        dark ? 'bg-white/10 text-cyan-200' : 'bg-accent text-accent-foreground',
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
                    <p className={cn('mt-2 text-sm leading-relaxed', dark ? 'text-white/60' : 'text-muted-foreground')}>{item.body}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section id="modules" className="scroll-mt-28">
          <div className="mx-auto max-w-3xl space-y-2 text-center">
            <span className={cn('text-xs font-bold tracking-wider uppercase', dark ? 'text-cyan-300' : 'text-info-text')}>
              Workspace modules
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">End-to-end resource governance</h2>
            <p className={cn('text-base', dark ? 'text-white/60' : 'text-muted-foreground')}>
              Demo-ready surfaces for operators — no charter-only clutter in the primary nav.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((item) => {
              const Icon = item.icon
              return (
                <article
                  key={item.title}
                  className={cn(
                    'feature-card group relative overflow-hidden rounded-2xl border p-6',
                    dark ? 'border-white/10 bg-white/[0.03]' : 'border-border bg-card shadow-card',
                  )}
                >
                  <HoverGrid className="opacity-0 transition-opacity duration-300 group-hover:opacity-100" density={40} />
                  <div className="relative z-[1] flex items-start gap-3">
                    <Icon className={cn('mt-0.5 size-5 shrink-0', dark ? 'text-cyan-300' : 'text-primary')} />
                    <div>
                      <h3 className="text-base font-bold">{item.title}</h3>
                      <p className={cn('mt-1.5 text-sm leading-relaxed', dark ? 'text-white/60' : 'text-muted-foreground')}>{item.body}</p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section
          id="workflow"
          className={cn(
            'scroll-mt-28 rounded-3xl border p-8 sm:p-12',
            dark ? 'border-white/10 bg-white/[0.03]' : 'border-border bg-card/80',
          )}
        >
          <div className="max-w-2xl">
            <span className={cn('text-xs font-bold tracking-wider uppercase', dark ? 'text-cyan-300' : 'text-info-text')}>
              Lifecycle
            </span>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight">Operational workflow</h2>
            <p className={cn('mt-2 text-sm', dark ? 'text-white/60' : 'text-muted-foreground')}>
              From submission to reconcile — only real stage trails, not decorative chrome.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW.map((step) => (
              <div
                key={step.n}
                className={cn(
                  'feature-card group relative overflow-hidden rounded-2xl border p-6',
                  dark ? 'border-white/10 bg-[#0b1220]/60' : 'border-border bg-background',
                )}
              >
                <HoverGrid className="opacity-0 transition-opacity duration-300 group-hover:opacity-100" density={32} />
                <div className="relative z-[1]">
                  <span className={cn('font-mono text-base font-extrabold', dark ? 'text-cyan-300' : 'text-primary')}>{step.n}</span>
                  <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
                  <p className={cn('mt-2 text-xs leading-relaxed', dark ? 'text-white/60' : 'text-muted-foreground')}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="scroll-mt-28 mx-auto max-w-3xl">
          <div className="space-y-2 text-center">
            <span className={cn('text-xs font-bold tracking-wider uppercase', dark ? 'text-cyan-300' : 'text-info-text')}>FAQ</span>
            <h2 className="text-3xl font-extrabold tracking-tight">Frequently asked questions</h2>
          </div>
          <div className={cn('mt-10 divide-y border-y', dark ? 'divide-white/10 border-white/10' : 'divide-border border-border')}>
            {FAQ.map((item, idx) => {
              const open = openFaq === idx
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 py-6 text-left text-base font-bold"
                    onClick={() => setOpenFaq(open ? -1 : idx)}
                    aria-expanded={open}
                  >
                    <span>{item.q}</span>
                    <ChevronDown className={cn('size-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180 text-primary')} />
                  </button>
                  {open && <p className={cn('pb-6 text-sm leading-relaxed', dark ? 'text-white/65' : 'text-muted-foreground')}>{item.a}</p>}
                </div>
              )
            })}
          </div>
        </section>

        <section
          className={cn(
            'rounded-3xl border p-10 text-center sm:p-14',
            dark
              ? 'border-primary/30 bg-gradient-to-r from-primary/15 via-transparent to-info/10'
              : 'border-primary/25 bg-gradient-to-r from-accent via-card to-info-soft/40',
          )}
        >
          <div className="mx-auto max-w-2xl space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tight">Ready to govern quantum resources?</h2>
            <p className={cn('text-base', dark ? 'text-white/70' : 'text-muted-foreground')}>
              Sign in with the demo admin account, open Approvals, and walk the real stage trail.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-2">
              <Link to="/login" className="btn-primary gap-2 px-6 py-3 text-base">
                Sign in <ArrowRight className="size-4" />
              </Link>
              <Link to="/register" className="btn-secondary px-6 py-3 text-base">
                Create account
              </Link>
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  )
}
