/** Short header line + tooltip detail for workspace shell (Operate mode — no subtitle essays). */
export type PageGuidance = { description: string; descriptionHelp: string }

export const opsPageGuidance = {
  centre: {
    description: 'Fleet, queues, reconcile, and incidents.',
    descriptionHelp:
      'Organization operations posture: fleet health, queue depth, reconcile backlog, and open exceptions.',
  },
  incidents: {
    description: 'Exception cases and linked alerts.',
    descriptionHelp: 'Lifecycle, ownership, and fleet alerts tied to each incident.',
  },
  jobs: {
    description: 'Provider jobs for your tenant.',
    descriptionHelp: 'Execution records attributed to your organization on the platform fabric.',
  },
  queues: {
    description: 'Pending jobs per backend.',
    descriptionHelp: 'Queue depth and condition from the latest telemetry sample per backend.',
  },
  jobsQueuesTab: {
    description: 'Queue depth per backend.',
    descriptionHelp: 'Platform queue telemetry your organization can see on shared backends.',
  },
  support: {
    description: 'Fleet alerts to triage.',
    descriptionHelp: 'Alerts on shared platform backends — review before opening an incident.',
  },
  approvals: {
    description: 'Workloads awaiting staged review.',
    descriptionHelp: 'Workloads from research projects; approve before quota authorise and dispatch.',
  },
  approvalDetail: {
    description: 'Governance request.',
    descriptionHelp: 'Staged review, quota check, and dispatch linkage. Decisions write audit; they do not run provider jobs.',
  },
  approvalHistory: {
    description: 'Past approval decisions.',
    descriptionHelp: 'Append-only record — later decisions do not rewrite earlier ones.',
  },
  inventory: {
    description: 'Register fleet before scheduling.',
    descriptionHelp: 'Catalogue assets and backends on the shared provider fabric.',
  },
  backends: {
    description: 'Platform backend catalogue.',
    descriptionHelp: 'Queue telemetry and operational status visible to your organization.',
  },
  connectors: {
    description: 'Integration connectors.',
    descriptionHelp: 'Stage, collector health, and dispatch readiness per connector.',
  },
  pools: {
    description: 'Virtual pools for scheduling.',
    descriptionHelp: 'Group registered assets for policy; membership does not reserve capacity.',
  },
  poolDetail: {
    description: 'Pool membership.',
    descriptionHelp: 'Add a registered asset. Membership does not reserve the asset.',
  },
  backendDetail: {
    description: 'Backend posture and telemetry.',
    descriptionHelp: 'Catalogue status, queue samples, and topology health for this backend.',
  },
  dispatch: {
    description: 'Dispatch attempts and ICD.',
    descriptionHelp: 'Provider jobs separate from governance approval — track attempts and contracts.',
  },
  reconciliation: {
    description: 'Record provider outcomes.',
    descriptionHelp: 'Reconcile dispatch results for authorized attempts.',
  },
  evidence: {
    description: 'Operational snapshots.',
    descriptionHelp: 'Point-in-time captures for incidents and audit.',
  },
  procurement: {
    description: 'Use inventory and quotas today.',
    descriptionHelp:
      'Procurement workflows are out of scope in this build. Register assets under Inventory; track headroom on Quotas.',
  },
  notifications: {
    description: 'In-app notices.',
    descriptionHelp: 'Governance queue sync and delivery through the header bell. Audit keeps durable records.',
  },
  metering: {
    description: 'Usage rollups in this window.',
    descriptionHelp: 'From approved workloads and provider jobs — not quota ledger balances.',
  },
  quotas: {
    description: 'Daily shot ledger and headroom.',
    descriptionHelp: 'Organization-wide ledger with optional drill-down by research project.',
  },
  audit: {
    description: 'Append-only audit trail.',
    descriptionHelp: 'Approvals, inventory, quotas, dispatch, and access admin events.',
  },
  reservations: {
    description: 'Governance holds on assets.',
    descriptionHelp: 'Calendar and list views; overlapping holds may need manual resolution.',
  },
  policies: {
    description: 'Approval policy versions.',
    descriptionHelp: 'Published stages, permissions, and version tied to the review queue.',
  },
  projects: {
    description: 'Research workspaces.',
    descriptionHelp: 'Workloads and approvals are scoped to a project inside your organization.',
  },
  projectDetail: {
    description: 'Project hub.',
    descriptionHelp: 'Members, requests, holds, and quota drill-down for this project.',
  },
  scheduling: {
    description: 'Governance capacity hold.',
    descriptionHelp: 'Reserve a window on a project asset after approval.',
  },
  sla: {
    description: 'SLA targets (read-only).',
    descriptionHelp: 'Formal breach prediction and credits are not implemented in this release.',
  },
  entitlements: {
    description: 'Capacity entitlements.',
    descriptionHelp: 'Daily quota ledger — not external contract SKUs.',
  },
  providers: {
    description: 'Platform provider registry.',
    descriptionHelp: 'CDAC-operated fabric — manifests and integration stage upstream of org inventory.',
  },
  providerDetail: {
    description: 'Provider onboarding.',
    descriptionHelp: 'Publish a capability manifest, then set active or suspended.',
  },
  onboarding: {
    description: 'Provider onboarding stages.',
    descriptionHelp: 'Stage codes from the connector catalogue; open a provider to publish and activate.',
  },
  adminOverview: {
    description: 'Access, approvals, and exceptions.',
    descriptionHelp: 'Resource access, allocation oversight, and operational exceptions.',
  },
  providerOverview: {
    description: 'Assignments and fleet status.',
    descriptionHelp: 'Manage resources, track assignments, and monitor operational status.',
  },
  researcherHome: {
    description: 'Your requests and quota at a glance.',
    descriptionHelp: 'Track resource requests, reservations, and workloads for your organization.',
  },
  jobDetail: {
    description: 'Provider execution record.',
    descriptionHelp: 'Telemetry, timeline, and dispatch attempts attributed to your tenant.',
  },
  incidentDetail: {
    description: 'Exception case workspace.',
    descriptionHelp: 'Acknowledge, investigate, and resolve. Summary and links live on the tabs below.',
  },
  assetDetail: {
    description: 'Registered asset lifecycle.',
    descriptionHelp: 'State moves only along allowed transitions. Holds and dispatch use other surfaces.',
  },
  alertDetail: {
    description: 'Single alert on shared fabric.',
    descriptionHelp: 'Open the parent incident when grouped. Drill one alert only when you need specifics.',
  },
  supportTriage: {
    description: 'Backends with the most active alerts in this sample.',
    descriptionHelp:
      'Many WARNING rows can share one backend. Work the incident first; open one alert only when you need detail.',
  },
  entitlementsScope: {
    description: 'External SKUs stay outside QRP.',
    descriptionHelp: 'Contract entitlements are maintained elsewhere. Capacity here uses the quota ledger and reservations.',
  },
  slaScope: {
    description: 'No breach API in this release.',
    descriptionHelp:
      'Use Metering for rollups and Incidents for exceptions. Missing telemetry stays unavailable, not 100% uptime.',
  },
  adminPeople: {
    description: 'Members, roles, catalogue.',
    descriptionHelp: 'Organization member directory, roles, and read-only permission catalogue.',
  },
  adminPermissions: {
    description: 'Capability catalogue.',
    descriptionHelp: 'Read-only. Grant capabilities by editing a custom organization role.',
  },
  adminRoles: {
    description: 'Organization roles.',
    descriptionHelp: 'System roles are fixed; create org-specific roles from the permission catalogue.',
  },
  adminRoleEditor: {
    description: 'Role scope and permissions.',
    descriptionHelp: 'Organization, project, or provider scope — pick permissions grouped by module.',
  },
  adminUserPermissions: {
    description: 'Effective capabilities.',
    descriptionHelp: 'Resolved from active role assignments at organization, project, or provider scope.',
  },
  organization: {
    description: 'Tenant identity and people.',
    descriptionHelp:
      'Organization profile, members, and invitations. Workloads, quotas, and audit stay scoped to this tenant on the CDAC platform.',
  },
  settings: {
    description: 'Account and workspace preferences.',
    descriptionHelp: 'Personal security and UI density. Organization profile and people live under Organization.',
  },
  profile: {
    description: 'Roles and effective permissions.',
    descriptionHelp: 'Capabilities resolved from assignments at organization, project, or provider scope.',
  },
} as const satisfies Record<string, PageGuidance>