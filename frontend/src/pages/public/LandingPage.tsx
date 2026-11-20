import './loadCertLandingStyles'

import { useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  BarChart3,
  Boxes,
  ChevronDown,
  ClipboardCheck,
  FileStack,
  Gauge,
  ScrollText,
  Send,
  Shield,
  Users,
} from 'lucide-react'

import { IntroSceneBackground } from '@/components/cert-studio/IntroSceneBackground'
import { LandingChrome } from '@/components/marketing/LandingChrome'
import { PublicShell } from '@/components/marketing/PublicShell'
import { MarketingContainer } from '@/components/ui/MarketingContainer'
import { StudioFeatureGrid, type StudioFeatureItem } from '@/components/ui/StudioFeatureGrid'
import { prefersReducedMotion } from '@/lib/motionPrefs'

const ICON = 22

const CAPABILITIES: StudioFeatureItem[] = [
  {
    icon: <ClipboardCheck size={ICON} strokeWidth={1.75} />,
    accent: 'var(--primary)',
    title: 'Stage-gated approvals',
    description:
      'Multi-step review with organization quota evaluation before authorise. Every decision is on the audit trail.',
  },
  {
    icon: <Gauge size={ICON} strokeWidth={1.75} />,
    accent: 'var(--accent, var(--brand-cyan, #06b6d4))',
    title: 'Capacity you can explain',
    description: 'Daily shot ledger, reservations, and org-wide metering rollups.',
  },
  {
    icon: <ScrollText size={ICON} strokeWidth={1.75} />,
    accent: 'var(--success, #059669)',
    title: 'Evidence on demand',
    description: 'Governance events, dispatch attempts, and exports your auditors can verify.',
  },
]

const MODULES: StudioFeatureItem[] = [
  {
    icon: <FileStack size={ICON} strokeWidth={1.75} />,
    accent: 'var(--primary)',
    title: 'Approvals',
    description: 'Org review queue, stage history, quota gate at decide.',
  },
  {
    icon: <BarChart3 size={ICON} strokeWidth={1.75} />,
    accent: 'var(--warning, #d97706)',
    title: 'Quotas & metering',
    description: 'Organization ledger, caps, usage rollups.',
  },
  {
    icon: <Boxes size={ICON} strokeWidth={1.75} />,
    accent: 'var(--success, #059669)',
    title: 'Inventory & pools',
    description: 'Fleet catalogue, pools, provider manifests.',
  },
  {
    icon: <Users size={ICON} strokeWidth={1.75} />,
    accent: 'var(--accent, var(--brand-cyan, #06b6d4))',
    title: 'Organization & projects',
    description: 'People & access, roles, project-scoped workloads.',
  },
  {
    icon: <Send size={ICON} strokeWidth={1.75} />,
    accent: 'var(--primary)',
    title: 'Dispatch reconcile',
    description: 'Attempt ledger for authorise and reconcile outcomes.',
  },
  {
    icon: <Shield size={ICON} strokeWidth={1.75} />,
    accent: 'var(--danger, #dc2626)',
    title: 'Audit & evidence',
    description: 'Append-only governance events and exports.',
  },
]

const WORKFLOW_STEPS = [
  {
    n: '01',
    title: 'Register',
    body: 'Create your organization and first administrator, then invite members.',
  },
  {
    n: '02',
    title: 'Submit',
    body: 'Open a research project and submit a workload to the org review queue.',
  },
  {
    n: '03',
    title: 'Review',
    body: 'Policy stages run at organization scope; quota must pass before authorise.',
  },
  {
    n: '04',
    title: 'Reconcile',
    body: 'Dispatch attempts and outcomes land on the org audit trail.',
  },
]

const FAQ = [
  {
    q: 'What is the Quantum Resource Portal?',
    a: 'CDAC-operated platform: each customer organization gets an isolated tenant with projects, approvals, quotas, inventory, and audit exports.',
  },
  {
    q: 'How do I start a review?',
    a: 'Sign in to your organization, open Approvals, and submit or decide workloads on your project policy stages.',
  },
  {
    q: 'Where is procurement?',
    a: 'Procurement is not in this release. Register platform inventory and track capacity in the organization quota ledger.',
  },
]

export function LandingPage() {
  const heroTileRef = useRef<HTMLDivElement>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const onHeroMouseMove = (e: React.MouseEvent) => {
    if (prefersReducedMotion()) return
    const el = heroTileRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    el.style.setProperty('--mouse-x', `${x}%`)
    el.style.setProperty('--mouse-y', `${y}%`)
  }

  const onHeroMouseLeave = () => {
    heroTileRef.current?.style.setProperty('--mouse-x', '50%')
    heroTileRef.current?.style.setProperty('--mouse-y', '40%')
  }

  return (
    <PublicShell className="landing-page">
      <IntroSceneBackground />
      <LandingChrome />
      <div className="landing-page__content">
        <main
          id="main-content"
          tabIndex={-1}
          className="outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          <section className="landing-hero" aria-labelledby="landing-hero-title">
            <MarketingContainer narrow className="landing-hero__container">
              <div className="landing-hero__float">
                <div
                  ref={heroTileRef}
                  className="landing-hero__glass-panel"
                  onMouseMove={onHeroMouseMove}
                  onMouseLeave={onHeroMouseLeave}
                >
                  <div className="landing-hero__glass-glow" aria-hidden />
                  <h1 id="landing-hero-title" className="landing-hero__title landing-hero__title--glass">
                    Quantum resource governance
                    <br />
                    <span className="landing-hero__title-accent">for every organization on the platform</span>
                  </h1>
                  <p className="landing-hero__lead landing-hero__lead--glass">
                    CDAC operates the shared provider fabric; your org gets isolated projects, approvals, quotas,
                    metering, and audit exports — the same public marketing craft as Cert Studio, with Q-TeleScope ops
                    density inside the workspace.
                  </p>
                  <div className="landing-hero__ctas">
                    <Link to="/login" className="btn-primary landing-cta-primary">
                      Sign in <ArrowRight size={18} aria-hidden />
                    </Link>
                    <Link to="/register" className="btn-secondary landing-cta-secondary--glass">
                      Register organization
                    </Link>
                  </div>
                </div>
              </div>
            </MarketingContainer>
          </section>

          <section id="capabilities" className="landing-section landing-section--surface" aria-labelledby="capabilities-title">
            <MarketingContainer>
              <h2 id="capabilities-title" className="landing-section__title">
                What you get
              </h2>
              <p className="landing-section__lead">
                Per-organization policy stages, capacity ledgers, and exportable records for accountable quantum ops.
              </p>
              <StudioFeatureGrid items={CAPABILITIES} className="studio-feature-grid--tri" />
            </MarketingContainer>
          </section>

          <section id="features" className="landing-section" aria-labelledby="features-title">
            <MarketingContainer>
              <h2 id="features-title" className="landing-section__title">
                Approvals, quotas, audit
              </h2>
              <p className="landing-section__lead">Fleet inventory, dispatch, and project access after sign-in.</p>
              <StudioFeatureGrid items={MODULES} />
            </MarketingContainer>
          </section>

          <section id="workflow" className="landing-section landing-section--surface" aria-labelledby="workflow-title">
            <MarketingContainer narrow>
              <h2 id="workflow-title" className="landing-section__title">
                From request to audit
              </h2>
              <p className="landing-section__lead">Submit, review, authorise, then reconcile dispatch.</p>
              <div className="landing-steps">
                {WORKFLOW_STEPS.map((s) => (
                  <div key={s.n} className="landing-step-card">
                    <div className="landing-step-card__num">{s.n}</div>
                    <div>
                      <h3 className="landing-step-card__title">{s.title}</h3>
                      <p className="landing-step-card__desc">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </MarketingContainer>
          </section>

          <section id="faq" className="landing-section" aria-labelledby="faq-title">
            <MarketingContainer narrow className="landing-faq-wrap">
              <h2 id="faq-title" className="landing-section__title">
                Questions
              </h2>
              <div className="landing-faq-list">
                {FAQ.map((item, idx) => {
                  const open = openFaq === idx
                  return (
                    <div key={item.q} className="landing-faq-item">
                      <button
                        type="button"
                        className="landing-faq-item__trigger"
                        onClick={() => setOpenFaq(open ? null : idx)}
                        aria-expanded={open}
                      >
                        {item.q}
                        <ChevronDown
                          size={18}
                          className={`landing-faq-item__chev${open ? ' landing-faq-item__chev--open' : ''}`}
                          aria-hidden
                        />
                      </button>
                      {open ? <div className="landing-faq-item__body">{item.a}</div> : null}
                    </div>
                  )
                })}
              </div>
            </MarketingContainer>
          </section>

          <section className="landing-section landing-section--cta" aria-labelledby="final-cta-title">
            <MarketingContainer narrow>
              <div className="landing-final-cta">
                <h2 id="final-cta-title">Open the workspace</h2>
                <p>Sign in to your organization workspace, or register a new org on lab deployments.</p>
                <div className="landing-hero__ctas">
                  <Link to="/login" className="btn-primary landing-cta-primary">
                    Sign in <ArrowRight size={18} aria-hidden />
                  </Link>
                  <Link to="/register" className="btn-secondary landing-cta-secondary--glass">
                    Register organization
                  </Link>
                </div>
              </div>
            </MarketingContainer>
          </section>
        </main>
      </div>
    </PublicShell>
  )
}