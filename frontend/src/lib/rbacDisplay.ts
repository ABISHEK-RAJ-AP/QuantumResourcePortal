/** Human labels for RBAC modules in access UI. */
export function moduleLabel(module: string): string {
  const key = module.toLowerCase()
  const map: Record<string, string> = {
    user: 'Users & membership',
    role: 'Roles',
    permission: 'Permission catalogue',
    membership: 'Membership',
    asset: 'Inventory',
    provider: 'Providers',
    project: 'Projects',
    approval: 'Approvals',
    policy: 'Policies',
    quota: 'Quotas',
    reservation: 'Reservations',
    workload: 'Workloads',
    audit: 'Audit',
    incident: 'Incidents',
    alert: 'Alerts',
    meter: 'Metering',
    connector: 'Connectors',
    governance: 'Governance',
  }
  if (map[key]) return map[key]
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}