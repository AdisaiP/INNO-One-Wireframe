import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  INNOCollection, INNOCollectionHeader, INNOIcon, INNOResourceHeader,
  INNOResourceSummary, INNOResourceSummaryItem, INNOState, INNOStatus,
  INNOSurfaceTabs, INNOTableWrap,
} from '@inno/ui';
import { getAdminUser } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { RouterRowAction } from '../components/RouterRowAction';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

export function AdminUserDetailPage() {
  const { t: t45n } = useStep45NI18n();
  const { userId = '' } = useParams();
  const canManage = usePermission('admin.users.manage');
  const [activeTab, setActiveTab] = useState<'overview' | 'access'>('overview');
  const user = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => getAdminUser(userId),
    enabled: !!userId,
  });

  if (user.isPending) return <div className="page-loading-wrap"><LoadingState label={t45n('admin.step45n.adminUserDetail.loadingUser')} /></div>;
  if (user.isError) return <div className="page-error-wrap"><ErrorState error={user.error} retry={() => void user.refetch()} /></div>;
  if (!user.data) return <main className="inno-page"><INNOState kind="error" title={t45n('admin.step45n.adminUserDetail.userNotFound')} /></main>;
  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/admin/users">{t45n('navigation.users')}</Link><span>›</span><span>{user.data.fullName}</span>
      </div>

      <INNOResourceHeader
        icon={<INNOIcon token="section.userProfiles" size={20} />}
        title={user.data.fullName}
        status={<INNOStatus tone={user.data.status === 'active' ? 'success' : 'neutral'}>{user.data.status}</INNOStatus>}
        meta={<><span>{user.data.employeeId}</span><span>·</span><span>{user.data.email}</span></>}
        actions={canManage ? <Link className="inno-btn inno-btn-secondary" to={'/admin/users/' + userId + '/edit'}>{t45n('admin.step45n.adminUserDetail.editProfile')}</Link> : undefined}
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label={t45n('profile.employeeId')} value={user.data.employeeId} detail="Canonical user identity" />
        <INNOResourceSummaryItem label={t45n('profile.organization')} value={user.data.organization?.name ?? 'Unassigned'} detail="Authorization scope" />
        <INNOResourceSummaryItem label={t45n('admin.step45n.adminPositions.position')} value={user.data.position?.name ?? 'Unassigned'} detail="Organization profile" />
        <INNOResourceSummaryItem label={t45n('profile.location')} value={user.data.location?.name ?? 'Unassigned'} detail={user.data.assignments.length + ' direct assignments'} />
      </INNOResourceSummary>

      <INNOSurfaceTabs
        ariaLabel={t45n('admin.step45n.adminUserDetail.userDetailSections')}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as 'overview' | 'access')}
        items={[{ id: 'overview', label: t45n('navigation.overview') }, { id: 'access', label: t45n('navigation.access') }]}
      />
      <div hidden={activeTab !== 'overview'}>
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>{t45n('admin.step45n.adminUserDetail.organizationProfile')}</h3><p>{t45n('admin.step45n.adminUserDetail.authenticationSubject')}{' '}{user.data.keycloakSubject}</p></div></div>
          <div className="kv-grid production-kv-grid">
            <div className="kv-row"><span>{t45n('profile.employeeId')}</span><b>{user.data.employeeId}</b></div>
            <div className="kv-row"><span>{t45n('profile.email')}</span><b>{user.data.email}</b></div>
            <div className="kv-row"><span>{t45n('profile.phone')}</span><b>{user.data.phone ?? '—'}</b></div>
            <div className="kv-row"><span>{t45n('profile.office')}</span><b>{user.data.office ?? '—'}</b></div>
            <div className="kv-row"><span>{t45n('profile.organization')}</span><b>{user.data.organization?.name ?? t45n('assets.automation.editor.owner.unassigned')}</b></div>
            <div className="kv-row"><span>{t45n('admin.step45n.adminPositions.position')}</span><b>{user.data.position?.name ?? t45n('assets.automation.editor.owner.unassigned')}</b></div>
            <div className="kv-row"><span>{t45n('profile.location')}</span><b>{user.data.location?.name ?? t45n('assets.automation.editor.owner.unassigned')}</b></div>
            <div className="kv-row"><span>{t45n('reports.runs.status')}</span><b>{user.data.status}</b></div>
          </div>
        </section>
      </div>

      <div hidden={activeTab !== 'access'}>
        <INNOCollection>
          <INNOCollectionHeader
            title={t45n('admin.step45n.adminAccessScopes.accessAssignments')}
            description={t45n('admin.step45n.adminUserDetail.roleScopeBindingsAppliedDirectlyToThisUser')}
            meta={<INNOStatus>{user.data.assignments.length} {t45n('admin.step45n.adminAccessScopes.assignments')}</INNOStatus>}
          />
          {user.data.assignments.length ? (
            <INNOTableWrap>
              <table>
                <thead><tr><th>{t45n('admin.step45n.adminAccessScopeEdit.role')}</th><th>{t45n('admin.step45n.adminAccessScopes.scope')}</th><th>{t45n('reports.runs.status')}</th><th className="action-column">{t45n('reports.table.action')}</th></tr></thead>
                <tbody>{user.data.assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td><b>{assignment.roleName}</b></td>
                    <td>{assignment.scopeType}</td>
                    <td><INNOStatus tone={assignment.status === 'active' ? 'success' : 'neutral'}>{assignment.status}</INNOStatus></td>
                    <td className="action-column">
                      <RouterRowAction to={'/admin/access-scopes/' + assignment.id + '/edit'} label={t45n('reports.action.edit')} ariaLabel={t45n('reports.action.edit') + ' ' + assignment.roleName + ' ' + t45n('admin.step45n.adminUserDetail.assignment')} />
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </INNOTableWrap>
          ) : (
            <div className="collection-state"><INNOState kind="empty" title={t45n('admin.step45n.adminUserDetail.noDirectAssignments')} description={t45n('admin.step45n.adminUserDetail.thisProfileDoesNotHaveADirectRole')} /></div>
          )}
        </INNOCollection>
      </div>
    </main>
  );
}
