# UI reference bridge (Q-TeleScope + Cert Studio)

**Applies to:** `frontend/src/styles/ref-ui-bridge.css` and shell `page-stack`.

| Reference | Pattern brought into QRP |
| --- | --- |
| Q-TeleScope `app-shell-density` | 15px body, 1.5 line-height on workspace; table cell sizing |
| Q-TeleScope `page-container` | `page-stack` max-width ~88rem centred in `shell-canvas` |
| Q-TeleScope toolbar | `min-height: 2.35rem` on primary inputs/buttons in workspace |
| Cert Studio register | `.cert-register-steps*` on `/register` |
| Cert Studio settings | Sidebar tab shells: Settings, Access, Organization hub |
| Cert Studio org/people | `/qrp/organization`, People & access crumbs |

**Not imported:** marketing bento motion, CeG commercial UI, AGPL vendor bundles.

**Landing:** Cert Studio stack — `IntroSceneBackground` (particle web / neon wire), glass hero, `StudioFeatureGrid`, `cert-studio/*.css` under `frontend/src/styles/cert-studio/`. No marketing bento spans.

**Auth (login / forgot / reset / MFA):** `cert-auth-pages.css` + `AuthPanel` / `AuthOutlineField` — intro scene, wire backdrop, centred login card (~460px).

**Auth (register):** Q-TeleScope `register-studio` — `AuthRegisterStudio`, `register-cert.css`, `RegisterStepTrail`, wide `reg-cert-panel`, wizard pills, type tiles + two-column `reg-stage` (brand aside + form). Source: TeleScope `AuthShell` layout `register-studio` + `frontend/src/styles/register-cert.css`.

**Governance copy pass:** Approvals, Inventory, Providers, Policies, Reservations, Audit, Support — `screens.tsx` / `continue.tsx`.

**Org hub:** Cert `org-section-*` in `org-studio.css` on `/qrp/organization`.

**Compute / ops:** Jobs, Queues, Operations centre, Reconciliation, Scheduling — org wording in `continue.tsx`.

**Integration & exceptions:** Connectors, Dispatch, Incidents (+ detail), Evidence, Notifications, Entitlements, Onboarding, Procurement, Support — org copy and `RelatedNav` → `/qrp/organization` in `continue.tsx` / `screens.tsx`.

**Resources & home:** Home, Approvals, Inventory, Providers, Projects, Policies, Audit — `RelatedNav` org link; Backends/Pools/Assets/Alerts/Provider detail/Job detail — org descriptions in `continue.tsx` / `screens.tsx`.

**Capacity & admin:** Quotas, Reservations, Metering, Approval detail, Settings, Profile — `RelatedNav` and org copy in `screens.tsx` / `pages/system/*`.

**Access & org hub:** `UsersAdminPage`, Roles/Permissions editors, `OrganizationHubPage`, auth shell — org copy + `RelatedNav` in `pages/admin/*`, `pages/organization/*`, `AuthPanel.tsx`.

**Verify:** `npm run typecheck`; spot-check Home, Organization, Register, Access, Landing bento, Review queue, Dispatch, Incidents, Connectors.