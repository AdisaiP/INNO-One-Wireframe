import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOIcon, INNOPage, INNOState, type INNOIconToken } from '@inno/ui';
import { getAdminOverview } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

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

          <div className="admin-overview-group">
            <div className="admin-overview-group-title">Organization & access</div>
            <div className="admin-overview-grid">
              <AdminTile to="/admin/organization" icon="section.organization" title="Organization Structure" description="Manage organization units and hierarchy." />
              <AdminTile to="/admin/locations" icon="section.locations" title="Locations" description="Maintain reusable location hierarchy." />
              <AdminTile to="/admin/positions" icon="section.positions" title="Positions" description="Maintain canonical job positions." />
              <AdminTile to="/admin/users" icon="section.users" title="Users" description="Browse and maintain organization profiles." />
              <AdminTile to="/admin/roles" icon="section.roles" title="Roles & Permissions" description="Inspect centralized RBAC permissions." />
              <AdminTile to="/admin/access-scopes" icon="section.accessScopes" title="Access Scopes" description="Manage role + resource-scope bindings." />
            </div>
          </div>

          <div className="admin-overview-group">
            <div className="admin-overview-group-title">Platform</div>
            <div className="admin-overview-grid">
              {canViewIntegrations ? <AdminTile to="/admin/integrations" icon="section.integrations" title="Integrations" description="Monitor integration health and run safe connection tests." /> : null}
              {canViewSecurity ? <AdminTile to="/admin/security" icon="section.security" title="Security" description="Inspect identity, transport, authorization, and audit posture." /> : null}
              {canViewAudit ? <AdminTile to="/admin/audit" icon="section.audit" title="Audit Log" description="Search immutable privileged and operational history." /> : null}
              {canManageBranding ? <AdminTile to="/admin/branding" icon="section.branding" title="Branding" description="Inspect effective product identity and frozen brand tokens." /> : null}
              {canManageSettings ? <AdminTile to="/admin/settings" icon="section.settings" title="Platform Settings" description="Inspect effective global platform conventions and deployment-managed values." /> : null}
              {canViewApps ? <AdminTile to="/admin/apps" icon="section.modules" title="Apps & Modules" description="Manage installed module availability." /> : null}
            </div>
          </div>

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
