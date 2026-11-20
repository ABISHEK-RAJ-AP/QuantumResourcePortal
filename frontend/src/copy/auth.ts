/** Public auth copy — aligned with Q-TeleScope operator auth strings; QRP tenant wording. */

export const AUTH_COPY = {
  signInSubtitle: 'Access your organization workspace with portal credentials.',
  registerSubtitle:
    'Provision an isolated organization workspace — members, projects, quotas, and usage on the quantum resource platform.',
  registerOrgStepSubtitle: 'Organization type, short tenant code, and legal name.',
  registerAdminStepSubtitle: 'Username and profile for the organization administrator.',
  registerSecurityStepSubtitle: 'Password for the administrator (platform policy applies).',
  registerOrgAside:
    'Each organization is an isolated tenant: members, projects, quotas, and usage. CDAC operates the shared provider catalog; you govern people and workloads inside your org.',
  registerAdminAside:
    'This person becomes the organization administrator: invite members, assign roles, and configure access.',
  registerSecurityAside: 'Use a strong password. You can change it later under account settings.',
  registerClosed: 'Organization sign-up is disabled on this deployment.',
} as const