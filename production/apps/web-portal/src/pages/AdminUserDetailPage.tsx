import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOEditorFooter,
  INNOEditorFooterEnd,
  INNOEditorFooterStart,
  INNOIcon,
  INNOResourceHeader,
  INNOResourceSummary,
  INNOResourceSummaryItem,
  INNOState,
  INNOStatus,
  INNOSurfaceTabs,
  INNOTableWrap,
} from '@inno/ui';
import { getAdminLocations, getAdminOrganizationTree, getAdminPositions, getAdminUser, updateAdminUser } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

export function AdminUserDetailPage() {
  const { userId = '' } = useParams();
  const canManage = usePermission('admin.users.manage');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'access'>('overview');
  const [editing, setEditing] = useState(false);
  const user = useQuery({ queryKey: ['admin', 'user', userId], queryFn: () => getAdminUser(userId), enabled: !!userId });
  const organizations = useQuery({ queryKey: ['admin', 'organization'], queryFn: getAdminOrganizationTree });
  const locations = useQuery({ queryKey: ['admin', 'location'], queryFn: getAdminLocations });
  const positions = useQuery({ queryKey: ['admin', 'positions'], queryFn: getAdminPositions });
  const [form, setForm] = useState({ employeeId: '', fullName: '', email: '', phone: '', office: '', organizationId: '', positionId: '', locationId: '', status: 'active' });

  useEffect(() => {
    if (!user.data) return;
    setForm({
      employeeId: user.data.employeeId,
      fullName: user.data.fullName,
      email: user.data.email,
      phone: user.data.phone ?? '',
      office: user.data.office ?? '',
      organizationId: user.data.organization?.id ?? '',
      positionId: user.data.position?.id ?? '',
      locationId: user.data.location?.id ?? '',
      status: user.data.status,
    });
  }, [user.data]);

  function cancelEditing() {
    if (user.data) {
      setForm({
        employeeId: user.data.employeeId,
        fullName: user.data.fullName,
        email: user.data.email,
        phone: user.data.phone ?? '',
        office: user.data.office ?? '',
        organizationId: user.data.organization?.id ?? '',
        positionId: user.data.position?.id ?? '',
        locationId: user.data.location?.id ?? '',
        status: user.data.status,
      });
    }
    setEditing(false);
  }

  const save = useMutation({
    mutationFn: () => {
      if (!user.data) throw new Error('User profile is not loaded.');
      return updateAdminUser(user.data.id, user.data.eTag, {
        employeeId: form.employeeId.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        office: form.office.trim() || null,
        organizationId: form.organizationId || null,
        positionId: form.positionId || null,
        locationId: form.locationId || null,
        status: form.status,
      });
    },
    onSuccess: async () => {
      setEditing(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
      ]);
    },
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
        actions={canManage && !editing ? (
          <INNOButton variant="secondary" onClick={() => { setActiveTab('overview'); setEditing(true); }}>Edit Profile</INNOButton>
        ) : undefined}
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label="Employee ID" value={user.data.employeeId} detail="Canonical user identity" />
        <INNOResourceSummaryItem label="Organization" value={user.data.organization?.name ?? 'Unassigned'} detail="Authorization scope" />
        <INNOResourceSummaryItem label="Position" value={user.data.position?.name ?? 'Unassigned'} detail="Organization profile" />
        <INNOResourceSummaryItem label="Location" value={user.data.location?.name ?? 'Unassigned'} detail={user.data.assignments.length + ' direct assignments'} />
      </INNOResourceSummary>

      {!editing ? (
        <INNOSurfaceTabs
          ariaLabel="User detail sections"
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as 'overview' | 'access')}
          items={[
            { id: 'overview', label: 'Overview' },
            { id: 'access', label: 'Access' },
          ]}
        />
      ) : null}

      <div hidden={activeTab !== 'overview'}>
        <section className="prod-panel">
          <div className="prod-panel-head">
            <div>
              <h3>{editing ? 'Edit organization profile' : 'Organization profile'}</h3>
              <p>Authentication subject: {user.data.keycloakSubject}</p>
            </div>
          </div>

          {editing ? (
            <form className="editor-form" onSubmit={(event) => { event.preventDefault(); if (!save.isPending) save.mutate(); }}>
              <div className="editor-grid">
                <label className="field-block"><span>Employee ID</span><input required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></label>
                <label className="field-block"><span>Full name</span><input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
                <label className="field-block"><span>Email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                <label className="field-block"><span>Phone</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                <label className="field-block"><span>Office</span><input value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })} /></label>
                <label className="field-block"><span>Organization unit</span><select value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}><option value="">Unassigned</option>{organizations.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="field-block"><span>Position</span><select value={form.positionId} onChange={(e) => setForm({ ...form, positionId: e.target.value })}><option value="">Unassigned</option>{positions.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="field-block"><span>Location</span><select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}><option value="">Unassigned</option>{locations.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="field-block"><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
              </div>
              {save.isError ? <ErrorState error={save.error} /> : null}
              <INNOEditorFooter>
                <INNOEditorFooterStart>
                  <INNOButton type="button" variant="secondary" disabled={save.isPending} onClick={cancelEditing}>Cancel</INNOButton>
                </INNOEditorFooterStart>
                <INNOEditorFooterEnd>
                  <INNOButton type="submit" busy={save.isPending} disabled={!form.employeeId.trim() || !form.fullName.trim() || !form.email.trim()}>Save Profile</INNOButton>
                </INNOEditorFooterEnd>
              </INNOEditorFooter>
            </form>
          ) : (
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
          )}
        </section>
      </div>

      <div hidden={activeTab !== 'access'}>
        <INNOCollection>
          <INNOCollectionHeader title="Access Assignments" description="Role + scope bindings applied directly to this user." meta={<INNOStatus>{user.data.assignments.length} assignments</INNOStatus>} />
          {user.data.assignments.length ? (
            <INNOTableWrap>
              <table>
                <thead><tr><th>Role</th><th>Scope</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>
                  {user.data.assignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td><b>{assignment.roleName}</b></td>
                      <td>{assignment.scopeType}</td>
                      <td><INNOStatus tone={assignment.status === 'active' ? 'success' : 'neutral'}>{assignment.status}</INNOStatus></td>
                      <td className="action-column"><Link className="device-row-action" to={'/admin/access-scopes?assignment=' + assignment.id} aria-label={'Open ' + assignment.roleName + ' assignment'}><INNOIcon token="action.next" size={14} /></Link></td>
                    </tr>
                  ))}
                </tbody>
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
