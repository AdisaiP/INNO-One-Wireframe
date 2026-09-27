export const contractVersions = {
  designSystem: 'V1.26',
  ui: '1.20.0',
  api: '0.2.0',
  eventAudit: '0.3.0',
  dataModel: '0.4.0',
  implementation: '0.15.0',
} as const;

export const apiBasePath = '/api/v1' as const;

export const moduleRoutes = {
  workspace: '/',
  apps: '/apps',
  devices: '/devices',
  assets: '/assets',
  helpdesk: '/helpdesk',
  meeting: '/meeting',
  reports: '/reports',
  admin: '/admin',
} as const;

export type ModuleKey = keyof typeof moduleRoutes;
