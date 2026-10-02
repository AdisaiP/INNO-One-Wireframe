import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  INNOButton, INNOEditorFooter, INNOEditorFooterEnd, INNOEditorFooterStart,
  INNOPage,
} from '@inno/ui';
import {
  createAdminUser, getAdminLocations, getAdminOrganizationTree, getAdminPositions,
  getAdminUser, updateAdminUser,
} from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

const blankForm = {
  keycloakSubject: '', employeeId: '', fullName: '', email: '', phone: '', office: '',
  organizationId: '', positionId: '', locationId: '', status: 'active',
};

export function AdminUserEditorPage() {
  const { userId } = useParams();
  const editing = Boolean(userId);
  const canManage = usePermission('admin.users.manage');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(blankForm);
  const user = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => getAdminUser(userId ?? ''),
    enabled: editing,
  });
  const organizations = useQuery({ queryKey: ['admin', 'organization'], queryFn: getAdminOrganizationTree });
  const locations = useQuery({ queryKey: ['admin', 'location'], queryFn: getAdminLocations });
  const positions = useQuery({ queryKey: ['admin', 'positions'], queryFn: getAdminPositions });

  useEffect(() => {
    if (!user.data) return;
    setForm({
      keycloakSubject: user.data.keycloakSubject,
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
    mutationFn: async () => {
      if (!canManage) throw new Error('You do not have permission to manage users.');
      if (editing) {
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
      }
      return createAdminUser({
        keycloakSubject: form.keycloakSubject.trim(),
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
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'user', saved.id] }),
      ]);
      navigate('/admin/users/' + saved.id, { replace: true });
    },
  });

  if (!canManage) {
    return <INNOPage eyebrow="Admin Center · Organization" title="User Editor" description="You do not have permission to manage users." />;
  }
  if (editing && user.isPending) return <div className="page-loading-wrap"><LoadingState label="Loading user…" /></div>;
  if (editing && user.isError) return <div className="page-error-wrap"><ErrorState error={user.error} retry={() => void user.refetch()} /></div>;

  const title = editing ? 'Edit User Profile' : 'New User Profile';
  return (
    <INNOPage
      eyebrow="Admin Center · Organization"
      title={title}
      description={editing ? 'Update organization profile data for this user.' : 'Link an existing Keycloak identity to an INNO.One organization profile.'}
    >
      <div className="resource-breadcrumb">
        <Link to="/admin/users">Users</Link><span>›</span><span>{title}</span>
      </div>
      <section className="prod-panel editor-route-panel">
        <div className="prod-panel-head"><div><h3>Profile details</h3><p>Authentication identity and organization metadata remain separate.</p></div></div>
        <form className="editor-form" onSubmit={(event) => { event.preventDefault(); if (!save.isPending) save.mutate(); }}>
          <div className="editor-grid">
            {!editing ? <label className="field-block"><span>Keycloak subject</span><input data-autofocus required value={form.keycloakSubject} onChange={(e) => setForm({ ...form, keycloakSubject: e.target.value })} /></label> : null}
            <label className="field-block"><span>Employee ID</span><input data-autofocus={editing || undefined} required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></label>
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
              <INNOButton type="button" variant="secondary" disabled={save.isPending} onClick={() => navigate(editing ? '/admin/users/' + userId : '/admin/users')}>Cancel</INNOButton>
            </INNOEditorFooterStart>
            <INNOEditorFooterEnd>
              <INNOButton
                type="submit"
                busy={save.isPending}
                disabled={!form.employeeId.trim() || !form.fullName.trim() || !form.email.trim() || (!editing && !form.keycloakSubject.trim())}
              >
                {editing ? 'Save Profile' : 'Create User'}
              </INNOButton>
            </INNOEditorFooterEnd>
          </INNOEditorFooter>
        </form>
      </section>
    </INNOPage>
  );
}
