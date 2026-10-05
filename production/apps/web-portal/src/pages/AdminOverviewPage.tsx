import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOIcon, INNOPage, INNOState, type INNOIconToken } from '@inno/ui';
import { getAdminOverview } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function AdminTile({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: INNOIconToken;
  title: string;
  description: string;
}) {
  return (
    <Link className="admin-overview-card" to={to}>
      <span className="admin-overview-icon" aria-hidden="true"><INNOIcon token={icon} size={16} /></span>
      <span className="admin-overview-copy"><b>{title}</b><small>{description}</small></span>
    </Link>
  );
}

export function AdminOverviewPage() {
  const { t: t45n } = useStep45NI18n();
  const canViewIntegrations = usePermission('admin.integrations.view');
  const canViewSecurity = usePermission('admin.security.view');
  const canViewAudit = usePermission('admin.audit.view');
  const canManageBranding = usePermission('admin.branding.manage');
  const canManageSettings = usePermission('admin.settings.manage');
  const canViewApps = usePermission('admin.apps.view');
  const query = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: getAdminOverview,
  });

  return (
    <INNOPage
      eyebrow={t45n('navigation.admin')}
      title={t45n('navigation.overview')}
      description={t45n('admin.step45n.adminOverview.manageOrganizationStructurePeopleAccessAndPlatformModules')}
    >
      {query.isPending ? <LoadingState label={t45n('admin.step45n.adminOverview.loadingAdminCenter')} /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      {query.data ? (
        <>
          <div className="production-stat-strip">
            <div><span>{t45n('admin.step45n.adminOverview.organizations')}</span><b>{query.data.organizations}</b><small>{t45n('admin.step45n.adminOverview.organizationUnits')}</small></div>
            <div><span>{t45n('navigation.locations')}</span><b>{query.data.locations}</b><small>{t45n('admin.step45n.adminOverview.reusableLocationNodes')}</small></div>
            <div><span>{t45n('navigation.users')}</span><b>{query.data.users}</b><small>{t45n('admin.step45n.adminOverview.organizationProfiles')}</small></div>
            <div><span>{t45n('admin.step45n.adminOverview.accessAssignments')}</span><b>{query.data.accessAssignments}</b><small>{t45n('admin.step45n.adminOverview.roleScopeBindings')}</small></div>
          </div>

          <div className="admin-overview-group">
            <div className="admin-overview-group-title">{t45n('admin.step45n.adminOverview.organizationAccess')}</div>
            <div className="admin-overview-grid">
              <AdminTile to="/admin/organization" icon="section.organization" title={t45n('admin.step45n.adminOverview.organizationStructure')} description={t45n('admin.step45n.adminOverview.manageOrganizationUnitsAndHierarchy')} />
              <AdminTile to="/admin/locations" icon="section.locations" title={t45n('navigation.locations')} description={t45n('admin.step45n.adminOverview.maintainReusableLocationHierarchy')} />
              <AdminTile to="/admin/positions" icon="section.positions" title={t45n('navigation.positions')} description={t45n('admin.step45n.adminOverview.maintainCanonicalJobPositions')} />
              <AdminTile to="/admin/users" icon="section.users" title={t45n('navigation.users')} description={t45n('admin.step45n.adminOverview.browseAndMaintainOrganizationProfiles')} />
              <AdminTile to="/admin/roles" icon="section.roles" title={t45n('navigation.rolesPermissions')} description={t45n('admin.step45n.adminOverview.inspectCentralizedRbacPermissions')} />
              <AdminTile to="/admin/access-scopes" icon="section.accessScopes" title={t45n('navigation.accessScopes')} description={t45n('admin.step45n.adminOverview.manageRoleResourceScopeBindings')} />
            </div>
          </div>

          <div className="admin-overview-group">
            <div className="admin-overview-group-title">{t45n('navigation.platform')}</div>
            <div className="admin-overview-grid">
              {canViewIntegrations ? <AdminTile to="/admin/integrations" icon="section.integrations" title={t45n('navigation.integrations')} description={t45n('admin.step45n.adminOverview.monitorIntegrationHealthAndRunSafeConnectionTests')} /> : null}
              {canViewSecurity ? <AdminTile to="/admin/security" icon="section.security" title={t45n('navigation.security')} description={t45n('admin.step45n.adminOverview.inspectIdentityTransportAuthorizationAndAuditPosture')} /> : null}
              {canViewAudit ? <AdminTile to="/admin/audit" icon="section.audit" title={t45n('navigation.auditLog')} description={t45n('admin.step45n.adminOverview.searchImmutablePrivilegedAndOperationalHistory')} /> : null}
              {canManageBranding ? <AdminTile to="/admin/branding" icon="section.branding" title={t45n('navigation.branding')} description={t45n('admin.step45n.adminOverview.inspectEffectiveProductIdentityAndFrozenBrandTokens')} /> : null}
              {canManageSettings ? <AdminTile to="/admin/settings" icon="section.settings" title={t45n('admin.settings.title')} description={t45n('admin.step45n.adminOverview.inspectEffectiveGlobalPlatformConventionsAndDeploymentManaged')} /> : null}
              {canViewApps ? <AdminTile to="/admin/apps" icon="section.modules" title={t45n('navigation.appsModules')} description={t45n('admin.step45n.adminOverview.manageInstalledModuleAvailability')} /> : null}
            </div>
          </div>

          {query.data.positions === 0 || query.data.roles === 0 ? (
            <INNOState
              kind="partial"
              banner
              title={t45n('admin.step45n.adminOverview.administrationMastersNeedAttention')}
              description={t45n('admin.step45n.adminOverview.existingAdministrationDataRemainsAvailableConfigurePositionsAnd')}
            />
          ) : null}
        </>
      ) : null}
    </INNOPage>
  );
}
