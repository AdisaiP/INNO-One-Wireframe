import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar,
  INNOEditorFooter, INNOEditorFooterEnd, INNOEditorFooterStart, INNOPage,
  INNOSearchField, INNOStatus, INNOTreeGrid,
} from '@inno/ui';
import {
  getAdminAccessAssignment, getAdminLocations, getAdminOrganizationTree,
  getAdminRoles, updateAdminAccessAssignment,
} from '../api/client';
import type { AdminHierarchyItem } from '../api/types';
import { CollectionErrorState, CollectionLoadingState, ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

export function AdminAccessScopeEditPage() {
  const { t: t45n } = useStep45NI18n();
  const { assignmentId = '' } = useParams();
  const canManage = usePermission('admin.access_scopes.manage');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [scopeSearch, setScopeSearch] = useState('');
  const [form, setForm] = useState({
    roleId: '', scopeType: 'all', resourceId: '', includeChildren: false,
    actionOverrides: '', status: 'active',
  });
  const assignment = useQuery({
    queryKey: ['admin', 'access-assignment', assignmentId],
    queryFn: () => getAdminAccessAssignment(assignmentId),
    enabled: !!assignmentId,
  });
  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: getAdminRoles });
  const organizations = useQuery({ queryKey: ['admin', 'organization'], queryFn: getAdminOrganizationTree });
  const locations = useQuery({ queryKey: ['admin', 'location'], queryFn: getAdminLocations });

  useEffect(() => {
    if (!assignment.data) return;
    setForm({
      roleId: assignment.data.roleId,
      scopeType: assignment.data.scopeType,
      resourceId: assignment.data.resources[0]?.id ?? '',
      includeChildren: assignment.data.includeChildren,
      actionOverrides: assignment.data.actionOverrides.join(', '),
      status: assignment.data.status,
    });
  }, [assignment.data]);

  const scopeOptions: AdminHierarchyItem[] = form.scopeType === 'organization'
    ? organizations.data ?? []
    : form.scopeType === 'location'
      ? locations.data ?? []
      : [];
  const scopeQuery = form.scopeType === 'organization' ? organizations : locations;
  const selectedScopeResource = useMemo(
    () => scopeOptions.find((item) => item.id === form.resourceId) ?? null,
    [form.resourceId, scopeOptions],
  );
  const save = useMutation({
    mutationFn: () => {
      if (!assignment.data) throw new Error(t45n('admin.step45n.adminAccessScopeEdit.accessAssignmentIsNotLoaded'));
      return updateAdminAccessAssignment(assignment.data.id, assignment.data.eTag, {
        roleId: form.roleId,
        scopeType: form.scopeType,
        resourceIds: form.scopeType === 'all' || !form.resourceId ? [] : [form.resourceId],
        includeChildren: form.includeChildren,
        actionOverrides: form.actionOverrides.split(',').map((value) => value.trim()).filter(Boolean),
        status: form.status,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'access-assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'access-assignment', assignmentId] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
      ]);
      navigate('/admin/access-scopes', { replace: true });
    },
  });

  if (!canManage) {
    return <INNOPage eyebrow={t45n('admin.step45n.adminAccessScopeEdit.adminCenterAccess')} title={t45n('admin.step45n.adminAccessScopeEdit.accessScopeEditor')} description={t45n('admin.step45n.adminAccessScopeEdit.youDoNotHavePermissionToManageAccess')} />;
  }
  if (assignment.isPending) return <div className="page-loading-wrap"><LoadingState label={t45n('admin.step45n.adminAccessScopeEdit.loadingAccessAssignment')} /></div>;
  if (assignment.isError) return <div className="page-error-wrap"><ErrorState error={assignment.error} retry={() => void assignment.refetch()} /></div>;
  if (!assignment.data) return null;
  const scopeBrowserVisible = form.scopeType === 'organization' || form.scopeType === 'location';
  return (
    <INNOPage
      eyebrow={t45n('admin.step45n.adminAccessScopeEdit.adminCenterAccess')}
      title={t45n('admin.step45n.adminAccessScopeEdit.editAccessAssignmentTitle', { name: assignment.data.subjectName })}
      description={t45n('admin.step45n.adminAccessScopeEdit.updateTheRoleAndResourceScopeOnA')}
    >
      <div className="resource-breadcrumb">
        <Link to="/admin/access-scopes">{t45n('navigation.accessScopes')}</Link><span>›</span><span>{assignment.data.subjectName}</span>
      </div>

      <section className="prod-panel editor-route-panel">
        <div className="prod-panel-head"><div><h3>{t45n('admin.step45n.adminAccessScopeEdit.assignmentDetails')}</h3><p>{assignment.data.subjectName} · {assignment.data.roleName}</p></div></div>
        <form className="editor-form" onSubmit={(e) => { e.preventDefault(); if (!save.isPending) save.mutate(); }}>
          <div className="editor-grid">
            <label className="field-block"><span>{t45n('admin.step45n.adminAccessScopeEdit.role')}</span><select data-autofocus value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>{roles.data?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
            <label className="field-block"><span>{t45n('admin.step45n.adminAccessScopeEdit.scopeType')}</span><select value={form.scopeType} onChange={(e) => { setScopeSearch(''); setForm({ ...form, scopeType: e.target.value, resourceId: '' }); }}><option value="all">{t45n('admin.step45n.adminAccessScopeEdit.all')}</option><option value="organization">{t45n('profile.organization')}</option><option value="location">{t45n('profile.location')}</option><option value="device_group">{t45n('admin.step45n.adminAccessScopeEdit.deviceGroup')}</option></select></label>
            {scopeBrowserVisible ? (
              <div className="field-block field-wide"><span>{t45n('assets.automation.runs.table.resource')}</span><div className="admin-scope-resource-summary" aria-live="polite"><b>{selectedScopeResource?.name ?? t45n('admin.step45n.adminAccessScopeEdit.noResourceSelected')}</b><span>{selectedScopeResource ? selectedScopeResource.code : t45n('admin.step45n.adminAccessScopeEdit.chooseAHierarchyRowInScopeBrowserBelow')}</span></div></div>
            ) : null}
            {form.scopeType === 'device_group' ? <label className="field-block"><span>{t45n('admin.step45n.adminAccessScopeEdit.deviceGroupId')}</span><input value={form.resourceId} onChange={(e) => setForm({ ...form, resourceId: e.target.value })} placeholder={t45n('admin.step45n.adminAccessScopeEdit.grp')} /></label> : null}
            <label className="field-block"><span>{t45n('reports.runs.status')}</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">{t45n('reports.status.active')}</option><option value="inactive">{t45n('admin.step45n.adminAccessScopeEdit.inactive')}</option></select></label>
            <label className="field-block field-wide"><span>{t45n('admin.step45n.adminAccessScopeEdit.actionOverrides')}</span><input value={form.actionOverrides} onChange={(e) => setForm({ ...form, actionOverrides: e.target.value })} placeholder={t45n('admin.step45n.adminAccessScopeEdit.permissionIdPermissionId')} /></label>
            <label className="field-block admin-check-field"><input type="checkbox" disabled={form.scopeType === 'all'} checked={form.includeChildren} onChange={(e) => setForm({ ...form, includeChildren: e.target.checked })} /><span>{t45n('admin.step45n.adminAccessScopeEdit.includeChildResources')}</span></label>
          </div>

          {scopeBrowserVisible ? (
            <INNOCollection className="admin-access-scope-browser">
              <INNOCollectionHeader
                title={t45n('admin.step45n.adminAccessScopeEdit.scopeBrowser')}
                description={form.scopeType === 'organization'
                  ? t45n('admin.step45n.adminAccessScopeEdit.chooseOneOrganizationNodeChildResourcesInheritOnly')
                  : t45n('admin.step45n.adminAccessScopeEdit.chooseOneLocationNodeFromTheCanonicalLocation')}
                meta={<INNOStatus>{scopeOptions.length} {t45n('admin.step45n.adminAccessScopeEdit.resources')}</INNOStatus>}
              />
              <INNOCollectionToolbar>
                <INNOSearchField label={t45n('admin.step45n.adminAccessScopeEdit.searchScopeResources')} value={scopeSearch} onChange={setScopeSearch} placeholder={t45n('admin.step45n.adminAccessScopeEdit.searchNameOrCode')} />
              </INNOCollectionToolbar>
              {scopeQuery.isPending ? <CollectionLoadingState label={t45n('admin.step45n.adminAccessScopeEdit.loadingScopeHierarchy')} /> : null}
              {scopeQuery.isError ? <CollectionErrorState error={scopeQuery.error} retry={() => void scopeQuery.refetch()} /> : null}
              {!scopeQuery.isPending && !scopeQuery.isError ? (
                <INNOTreeGrid
                  key={form.scopeType}
                  items={scopeOptions}
                  getId={(item) => item.id}
                  getParentId={(item) => item.parentId}
                  getLabel={(item) => item.name}
                  getSearchText={(item) => item.name + ' ' + item.code + ' ' + item.status}
                  primaryHeader={t45n('assets.automation.runs.table.resource')}
                  columns={[
                    { id: 'code', header: t45n('admin.step45n.adminHierarchy.code'), render: (item) => item.code },
                    { id: 'status', header: t45n('reports.runs.status'), render: (item) => <INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus> },
                  ]}
                  selectedId={form.resourceId}
                  onSelect={(id) => setForm({ ...form, resourceId: id })}
                  search={scopeSearch}
                  ariaLabel={form.scopeType === 'organization' ? t45n('admin.step45n.adminAccessScopeEdit.organizationScopeBrowser') : t45n('admin.step45n.adminAccessScopeEdit.locationScopeBrowser')}
                  emptyContent={scopeSearch ? t45n('admin.step45n.adminAccessScopeEdit.noHierarchyResourcesMatchThisSearch') : t45n('admin.step45n.adminAccessScopeEdit.noHierarchyResourcesAreAvailable')}
                />
              ) : null}
            </INNOCollection>
          ) : null}

          {save.isError ? <ErrorState error={save.error} /> : null}
          <INNOEditorFooter>
            <INNOEditorFooterStart><INNOButton type="button" variant="secondary" disabled={save.isPending} onClick={() => navigate('/admin/access-scopes')}>{t45n('reports.action.cancel')}</INNOButton></INNOEditorFooterStart>
            <INNOEditorFooterEnd><INNOButton type="submit" busy={save.isPending}>{t45n('admin.step45n.adminAccessScopeEdit.saveAssignment')}</INNOButton></INNOEditorFooterEnd>
          </INNOEditorFooter>
        </form>
      </section>
    </INNOPage>
  );
}
