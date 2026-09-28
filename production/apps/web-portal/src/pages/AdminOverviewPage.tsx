import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOCollection, INNOCollectionHeader, INNOPage, INNOState } from '@inno/ui';
import { getAdminOverview } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

export function AdminOverviewPage() {
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
      eyebrow="Admin Center"
      title="Overview"
      description="Manage organization structure, people, access, and platform modules from one administration boundary."
    >
      {query.isPending ? <LoadingState label="Loading Admin Center…" /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      {query.data ? (
        <>
          <div className="production-stat-strip">
            <div><span>Organizations</span><b>{query.data.organizations}</b><small>Organization units</small></div>
            <div><span>Locations</span><b>{query.data.locations}</b><small>Reusable location nodes</small></div>
            <div><span>Users</span><b>{query.data.users}</b><small>Organization profiles</small></div>
            <div><span>Access assignments</span><b>{query.data.accessAssignments}</b><small>Role + scope bindings</small></div>
          </div>

          <INNOCollection>
            <INNOCollectionHeader
              title="Administration areas"
              description="Open one focused administration job at a time."
            />
            <div className="admin-overview-grid">
              <Link className="admin-overview-card" to="/admin/organization"><b>Organization Structure</b><span>Manage organization units and hierarchy.</span></Link>
              <Link className="admin-overview-card" to="/admin/locations"><b>Locations</b><span>Maintain reusable location hierarchy.</span></Link>
              <Link className="admin-overview-card" to="/admin/positions"><b>Positions</b><span>Maintain canonical job positions.</span></Link>
              <Link className="admin-overview-card" to="/admin/users"><b>Users</b><span>Browse and maintain organization profiles.</span></Link>
              <Link className="admin-overview-card" to="/admin/roles"><b>Roles & Permissions</b><span>Inspect centralized RBAC permissions.</span></Link>
              <Link className="admin-overview-card" to="/admin/access-scopes"><b>Access Scopes</b><span>Manage role + resource-scope bindings.</span></Link>
              {canViewIntegrations ? <Link className="admin-overview-card" to="/admin/integrations"><b>Integrations</b><span>Monitor platform integration health and run safe connection tests.</span></Link> : null}
              {canViewSecurity ? <Link className="admin-overview-card" to="/admin/security"><b>Security</b><span>Inspect identity, transport, authorization, and audit posture.</span></Link> : null}
              {canViewAudit ? <Link className="admin-overview-card" to="/admin/audit"><b>Audit Log</b><span>Search immutable privileged and operational history.</span></Link> : null}
              {canManageBranding ? <Link className="admin-overview-card" to="/admin/branding"><b>Branding</b><span>Inspect the effective product identity and frozen brand tokens.</span></Link> : null}
              {canManageSettings ? <Link className="admin-overview-card" to="/admin/settings"><b>Platform Settings</b><span>Inspect effective global platform conventions and deployment-managed values.</span></Link> : null}
              {canViewApps ? <Link className="admin-overview-card" to="/admin/apps"><b>Apps & Modules</b><span>Manage installed module availability.</span></Link> : null}
            </div>
          </INNOCollection>

          {query.data.positions === 0 || query.data.roles === 0 ? (
            <INNOState
              kind="partial"
              compact
              title="Administration masters need attention"
              description="Positions and roles should be configured before assigning users and resource scopes."
            />
          ) : null}
        </>
      ) : null}
    </INNOPage>
  );
}
