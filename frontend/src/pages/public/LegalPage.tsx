import './loadCertLandingStyles'

import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { LandingChrome } from '@/components/marketing/LandingChrome'
import { PublicShell } from '@/components/marketing/PublicShell'
import { Card } from '@/components/layout/Page'
import { MarketingContainer } from '@/components/ui/MarketingContainer'

function LegalBody({
  title,
  children,
  links,
}: {
  title: string
  children: ReactNode
  links: ReactNode
}) {
  return (
    <PublicShell className="landing-page">
      <LandingChrome />
      <main id="main-content" tabIndex={-1} className="qrp-landing-main outline-none">
        <MarketingContainer className="py-10 sm:py-14">
          <h1 className="type-page-title type-trim text-left">{title}</h1>
          <Card className="hyphenate mt-4 space-y-3 text-left text-sm leading-relaxed text-muted-foreground">
            {children}
          </Card>
          <p className="mt-6 text-left text-sm">{links}</p>
        </MarketingContainer>
      </main>
    </PublicShell>
  )
}

/** DRAFT — operator must review before external users. */
export function PrivacyPage() {
  return (
    <LegalBody
      title="Privacy"
      links={
        <>
          <Link className="fs-link font-semibold" to="/legal/terms">
            Terms of use
          </Link>
          {' · '}
          <Link className="fs-link font-semibold" to="/login">
            Sign in
          </Link>
          {' · '}
          <Link className="fs-link font-semibold" to="/" reloadDocument>
            Home
          </Link>
        </>
      }
    >
      <p>
        <strong className="text-foreground">Quantum Resource Portal</strong> stores account identifiers, role
        assignments, governance and operational records you enter, and audit events. Sessions use HTTP-only cookies; the
        API does not ship analytics pixels in this build.
      </p>
      <p>Data stays in your deployment&apos;s PostgreSQL unless you configure exports. Operators control retention and backups.</p>
      <p className="text-xs">This page is a placeholder — not legal advice. Replace with counsel-reviewed text before public launch.</p>
    </LegalBody>
  )
}

export function TermsPage() {
  return (
    <LegalBody
      title="Terms of use"
      links={
        <>
          <Link className="fs-link font-semibold" to="/legal/privacy">
            Privacy (draft)
          </Link>
          {' · '}
          <Link className="fs-link font-semibold" to="/" reloadDocument>
            Home
          </Link>
        </>
      }
    >
      <p>
        Use this portal only if you are authorised by your organisation. Do not share credentials. Operational actions
        are logged to the audit trail.
      </p>
      <p>The service is provided as deployed — no warranty in this lab profile. Report abuse to your platform administrator.</p>
      <p className="text-xs">Draft only — have legal counsel review before external or procurement use.</p>
    </LegalBody>
  )
}