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

export function AdminUserDetailPage() {
  const { userId = '' } = useParams();
  const canManage = usePermission('admin.users.manage');
  const [activeTab, setActiveTab] = useState<'overview' | 'access'>('overview');
  const user = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => getAdminUser(userId),
    enabled: !!userId,
  });

  if (user.isPending) return <div className="page-loading-wrap"><LoadingState label="Loading user…" /></div>;
  if (user.isError) return <div className="page-error-wrap"><ErrorState error={user.error} retry={() => void user.refetch()} /></div>;
  if (!user.data) return <main className="inno-page"><INNOState kind="error" title="User not found" /></main>;
  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/admin/users">Users</Link><span>›</span><span>{user.data.fullName}</span>
      </div>

      <INNOResourceHeader
        icon={<INNOIcon token="section.userProfiles" size={20} />}
        title={user.data.fullName}
        status={<INNOStatus tone={user.data.status === 'active' ? 'success' : 'neutral'}>{user.data.status}</INNOStatus>}
        meta={<><span>{user.data.employeeId}</span><span>·</span><span>{user.data.email}</span></>}
        actions={canManage ? <Link className="inno-btn inno-btn-secondary" to={'/admin/users/' + userId + '/edit'}>Edit Profile</Link> : undefined}
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label="Employee ID" value={user.data.employeeId} detail="Canonical user identity" />
        <INNOResourceSummaryItem label="Organization" value={user.data.organization?.name ?? 'Unassigned'} detail="Authorization scope" />
        <INNOResourceSummaryItem label="Position" value={user.data.position?.name ?? 'Unassigned'} detail="Organization profile" />
        <INNOResourceSummaryItem label="Location" value={user.data.location?.name ?? 'Unassigned'} detail={user.data.assignments.length + ' direct assignments'} />
      </INNOResourceSummary>

      <INNOSurfaceTabs
        ariaLabel="User detail sections"
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as 'overview' | 'access')}
        items={[{ id: 'overview', label: 'Overview' }, { id: 'access', label: 'Access' }]}
      />
      <div hidden={activeTab !== 'overview'}>
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Organization profile</h3><p>Authentication subject: {user.data.keycloakSubject}</p></div></div>
          <div className="kv-grid production-kv-grid">
            <div className="kv-row"><span>Employee ID</span><b>{user.data.employeeId}</b></div>
            <div className="kv-row"><span>Email</span><b>{user.data.email}</b></div>
            <div className="kv-row"><span>Phone</span><b>{user.data.phone ?? '—'}</b></div>
            <div className="kv-row"><span>Office</span><b>{user.data.office ?? '—'}</b></div>
            <div className="kv-row"><span>Organization</span><b>{user.data.organization?.name ?? 'Unassigned'}</b></div>
            <div className="kv-row"><span>Position</span><b>{user.data.position?.name ?? 'Unassigned'}</b></div>
            <div className="kv-row"><span>Location</span><b>{user.data.location?.name ?? 'Unassigned'}</b></div>
            <div className="kv-row"><span>Status</span><b>{user.data.status}</b></div>
          </div>
        </section>
      </div>

      <div hidden={activeTab !== 'access'}>
        <INNOCollection>
          <INNOCollectionHeader
            title="Access Assignments"
            description="Role + scope bindings applied directly to this user."
            meta={<INNOStatus>{user.data.assignments.length} assignments</INNOStatus>}
          />
          {user.data.assignments.length ? (
            <INNOTableWrap>
              <table>
                <thead><tr><th>Role</th><th>Scope</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>{user.data.assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td><b>{assignment.roleName}</b></td>
                    <td>{assignment.scopeType}</td>
                    <td><INNOStatus tone={assignment.status === 'active' ? 'success' : 'neutral'}>{assignment.status}</INNOStatus></td>
                    <td className="action-column">
                      <RouterRowAction to={'/admin/access-scopes/' + assignment.id + '/edit'} label="Edit" ariaLabel={'Edit ' + assignment.roleName + ' assignment'} />
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </INNOTableWrap>
          ) : (
            <div className="collection-state"><INNOState kind="empty" title="No direct assignments" description="This profile does not have a direct role + scope binding." /></div>
          )}
        </INNOCollection>
      </div>
    </main>
  );
}
