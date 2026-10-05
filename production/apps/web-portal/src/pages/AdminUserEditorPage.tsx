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
import { useI18n as useStep45NI18n } from '@inno/i18n';

const blankForm = {
  keycloakSubject: '', employeeId: '', fullName: '', email: '', phone: '', office: '',
  organizationId: '', positionId: '', locationId: '', status: 'active',
};

export function AdminUserEditorPage() {
  const { t: t45n } = useStep45NI18n();
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
      if (!canManage) throw new Error(t45n('admin.step45n.adminUserEditor.youDoNotHavePermissionToManageUsers'));
      if (editing) {
        if (!user.data) throw new Error(t45n('admin.step45n.adminUserEditor.userProfileIsNotLoaded'));
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
    return <INNOPage eyebrow={t45n('admin.step45n.adminHierarchy.adminCenterOrganization')} title={t45n('admin.step45n.adminUserEditor.userEditor')} description={t45n('admin.step45n.adminUserEditor.youDoNotHavePermissionToManageUsers')} />;
  }
  if (editing && user.isPending) return <div className="page-loading-wrap"><LoadingState label={t45n('admin.step45n.adminUserDetail.loadingUser')} /></div>;
  if (editing && user.isError) return <div className="page-error-wrap"><ErrorState error={user.error} retry={() => void user.refetch()} /></div>;

  const title = editing
    ? t45n('admin.step45n.adminUserEditor.editUserProfile')
    : t45n('admin.step45n.adminUserEditor.newUserProfile');
  return (
    <INNOPage
      eyebrow={t45n('admin.step45n.adminHierarchy.adminCenterOrganization')}
      title={title}
      description={editing ? t45n('admin.step45n.adminUserEditor.updateOrganizationProfileDataForThisUser') : t45n('admin.step45n.adminUserEditor.linkAnExistingKeycloakIdentityToAnInno')}
    >
      <div className="resource-breadcrumb">
        <Link to="/admin/users">{t45n('navigation.users')}</Link><span>›</span><span>{title}</span>
      </div>
      <section className="prod-panel editor-route-panel">
        <div className="prod-panel-head"><div><h3>{t45n('admin.step45n.adminUserEditor.profileDetails')}</h3><p>{t45n('admin.step45n.adminUserEditor.authenticationIdentityAndOrganizationMetadataRemainSeparate')}</p></div></div>
        <form className="editor-form" onSubmit={(event) => { event.preventDefault(); if (!save.isPending) save.mutate(); }}>
          <div className="editor-grid">
            {!editing ? <label className="field-block"><span>{t45n('admin.step45n.adminUserEditor.keycloakSubject')}</span><input data-autofocus required value={form.keycloakSubject} onChange={(e) => setForm({ ...form, keycloakSubject: e.target.value })} /></label> : null}
            <label className="field-block"><span>{t45n('profile.employeeId')}</span><input data-autofocus={editing || undefined} required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></label>
            <label className="field-block"><span>{t45n('admin.step45n.adminUserEditor.fullName')}</span><input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
            <label className="field-block"><span>{t45n('profile.email')}</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="field-block"><span>{t45n('profile.phone')}</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="field-block"><span>{t45n('profile.office')}</span><input value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })} /></label>
            <label className="field-block"><span>{t45n('admin.step45n.adminUserEditor.organizationUnit')}</span><select value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}><option value="">{t45n('assets.automation.editor.owner.unassigned')}</option>{organizations.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="field-block"><span>{t45n('admin.step45n.adminPositions.position')}</span><select value={form.positionId} onChange={(e) => setForm({ ...form, positionId: e.target.value })}><option value="">{t45n('assets.automation.editor.owner.unassigned')}</option>{positions.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="field-block"><span>{t45n('profile.location')}</span><select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}><option value="">{t45n('assets.automation.editor.owner.unassigned')}</option>{locations.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="field-block"><span>{t45n('reports.runs.status')}</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">{t45n('reports.status.active')}</option><option value="inactive">{t45n('admin.step45n.adminAccessScopeEdit.inactive')}</option></select></label>
          </div>
          {save.isError ? <ErrorState error={save.error} /> : null}
          <INNOEditorFooter>
            <INNOEditorFooterStart>
              <INNOButton type="button" variant="secondary" disabled={save.isPending} onClick={() => navigate(editing ? '/admin/users/' + userId : '/admin/users')}>{t45n('reports.action.cancel')}</INNOButton>
            </INNOEditorFooterStart>
            <INNOEditorFooterEnd>
              <INNOButton
                type="submit"
                busy={save.isPending}
                disabled={!form.employeeId.trim() || !form.fullName.trim() || !form.email.trim() || (!editing && !form.keycloakSubject.trim())}
              >
                {editing ? t45n('admin.step45n.adminUserEditor.saveProfile') : t45n('admin.step45n.adminUserEditor.createUser')}
              </INNOButton>
            </INNOEditorFooterEnd>
          </INNOEditorFooter>
        </form>
      </section>
    </INNOPage>
  );
}
