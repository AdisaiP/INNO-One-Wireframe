import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { INNOIcon, INNOButton, INNOCollection, INNOCollectionHeader, INNOEditorFooter, INNOPage, INNOState, INNOStatus, INNOTableWrap } from '@inno/ui';
import { getAdminLocations, getAdminOrganizationTree, getAdminPositions, getAdminUser, updateAdminUser } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

export function AdminUserDetailPage() {
  const { userId = '' } = useParams();
  const canManage = usePermission('admin.users.manage');
  const queryClient = useQueryClient();
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
      ]);
    },
  });

  if (user.isPending) return <INNOPage eyebrow="Admin Center · Users" title="User Detail"><LoadingState label="Loading user…" /></INNOPage>;
  if (user.isError) return <INNOPage eyebrow="Admin Center · Users" title="User Detail"><ErrorState error={user.error} retry={() => void user.refetch()} /></INNOPage>;
  if (!user.data) return <INNOPage eyebrow="Admin Center · Users" title="User Detail"><INNOState kind="error" title="User not found" /></INNOPage>;

  return (
    <INNOPage
      eyebrow="Admin Center · Users"
      title={user.data.fullName}
      description={user.data.employeeId + ' · ' + user.data.email}
      actions={<Link className="inno-link-button secondary" to="/admin/users">Back to Users</Link>}
    >
      <div className="admin-user-layout">
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Organization Profile</h3><p>Authentication subject: {user.data.keycloakSubject}</p></div><INNOStatus tone={user.data.status === 'active' ? 'success' : 'neutral'}>{user.data.status}</INNOStatus></div>
          <form className="editor-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="editor-grid">
              <label className="field-block"><span>Employee ID</span><input required disabled={!canManage} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></label>
              <label className="field-block"><span>Full name</span><input required disabled={!canManage} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
              <label className="field-block"><span>Email</span><input required type="email" disabled={!canManage} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label className="field-block"><span>Phone</span><input disabled={!canManage} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <label className="field-block"><span>Office</span><input disabled={!canManage} value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })} /></label>
              <label className="field-block"><span>Organization unit</span><select disabled={!canManage} value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}><option value="">Unassigned</option>{organizations.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="field-block"><span>Position</span><select disabled={!canManage} value={form.positionId} onChange={(e) => setForm({ ...form, positionId: e.target.value })}><option value="">Unassigned</option>{positions.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="field-block"><span>Location</span><select disabled={!canManage} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}><option value="">Unassigned</option>{locations.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="field-block"><span>Status</span><select disabled={!canManage} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            </div>
            {save.isError ? <ErrorState error={save.error} /> : null}
            {canManage ? <INNOEditorFooter><INNOButton type="submit" busy={save.isPending}>Save Profile</INNOButton></INNOEditorFooter> : null}
          </form>
        </section>

        <INNOCollection>
          <INNOCollectionHeader title="Access Assignments" description="Role + scope bindings applied directly to this user." meta={<INNOStatus>{user.data.assignments.length} assignments</INNOStatus>} />
          {user.data.assignments.length ? (
            <INNOTableWrap>
              <table><thead><tr><th>Role</th><th>Scope</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>{user.data.assignments.map((assignment) => <tr key={assignment.id}><td><b>{assignment.roleName}</b></td><td>{assignment.scopeType}</td><td><INNOStatus tone={assignment.status === 'active' ? 'success' : 'neutral'}>{assignment.status}</INNOStatus></td><td className="action-column"><Link className="device-row-action" to={'/admin/access-scopes?assignment=' + assignment.id} aria-label={'Open ' + assignment.roleName + ' assignment'}><INNOIcon token="action.next" size={14} /></Link></td></tr>)}</tbody>
              </table>
            </INNOTableWrap>
          ) : <div className="collection-state"><INNOState title="No direct assignments" description="This profile does not have a direct role + scope binding." /></div>}
        </INNOCollection>
      </div>
    </INNOPage>
  );
}
