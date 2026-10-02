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

export function AdminAccessScopeEditPage() {
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
      if (!assignment.data) throw new Error('Access assignment is not loaded.');
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
    return <INNOPage eyebrow="Admin Center · Access" title="Access Scope Editor" description="You do not have permission to manage access scopes." />;
  }
  if (assignment.isPending) return <div className="page-loading-wrap"><LoadingState label="Loading access assignment…" /></div>;
  if (assignment.isError) return <div className="page-error-wrap"><ErrorState error={assignment.error} retry={() => void assignment.refetch()} /></div>;
  if (!assignment.data) return null;
  const scopeBrowserVisible = form.scopeType === 'organization' || form.scopeType === 'location';
  return (
    <INNOPage
      eyebrow="Admin Center · Access"
      title={'Edit Access Assignment · ' + assignment.data.subjectName}
      description="Update the role and resource scope on a dedicated editor route."
    >
      <div className="resource-breadcrumb">
        <Link to="/admin/access-scopes">Access Scopes</Link><span>›</span><span>{assignment.data.subjectName}</span>
      </div>

      <section className="prod-panel editor-route-panel">
        <div className="prod-panel-head"><div><h3>Assignment details</h3><p>{assignment.data.subjectName} · {assignment.data.roleName}</p></div></div>
        <form className="editor-form" onSubmit={(e) => { e.preventDefault(); if (!save.isPending) save.mutate(); }}>
          <div className="editor-grid">
            <label className="field-block"><span>Role</span><select data-autofocus value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>{roles.data?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
            <label className="field-block"><span>Scope type</span><select value={form.scopeType} onChange={(e) => { setScopeSearch(''); setForm({ ...form, scopeType: e.target.value, resourceId: '' }); }}><option value="all">All</option><option value="organization">Organization</option><option value="location">Location</option><option value="device_group">Device Group</option></select></label>
            {scopeBrowserVisible ? (
              <div className="field-block field-wide"><span>Resource</span><div className="admin-scope-resource-summary" aria-live="polite"><b>{selectedScopeResource?.name ?? 'No resource selected'}</b><span>{selectedScopeResource ? selectedScopeResource.code : 'Choose a hierarchy row in Scope Browser below.'}</span></div></div>
            ) : null}
            {form.scopeType === 'device_group' ? <label className="field-block"><span>Device Group ID</span><input value={form.resourceId} onChange={(e) => setForm({ ...form, resourceId: e.target.value })} placeholder="grp_…" /></label> : null}
            <label className="field-block"><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <label className="field-block field-wide"><span>Action overrides</span><input value={form.actionOverrides} onChange={(e) => setForm({ ...form, actionOverrides: e.target.value })} placeholder="permission.id, permission.id" /></label>
            <label className="field-block admin-check-field"><input type="checkbox" disabled={form.scopeType === 'all'} checked={form.includeChildren} onChange={(e) => setForm({ ...form, includeChildren: e.target.checked })} /><span>Include child resources</span></label>
          </div>

          {scopeBrowserVisible ? (
            <INNOCollection className="admin-access-scope-browser">
              <INNOCollectionHeader
                title="Scope Browser"
                description={form.scopeType === 'organization'
                  ? 'Choose one organization node. Child resources inherit only when Include child resources is enabled.'
                  : 'Choose one location node from the canonical location hierarchy.'}
                meta={<INNOStatus>{scopeOptions.length} resources</INNOStatus>}
              />
              <INNOCollectionToolbar>
                <INNOSearchField label="Search scope resources" value={scopeSearch} onChange={setScopeSearch} placeholder="Search name or code…" />
              </INNOCollectionToolbar>
              {scopeQuery.isPending ? <CollectionLoadingState label="Loading scope hierarchy…" /> : null}
              {scopeQuery.isError ? <CollectionErrorState error={scopeQuery.error} retry={() => void scopeQuery.refetch()} /> : null}
              {!scopeQuery.isPending && !scopeQuery.isError ? (
                <INNOTreeGrid
                  key={form.scopeType}
                  items={scopeOptions}
                  getId={(item) => item.id}
                  getParentId={(item) => item.parentId}
                  getLabel={(item) => item.name}
                  getSearchText={(item) => item.name + ' ' + item.code + ' ' + item.status}
                  primaryHeader="Resource"
                  columns={[
                    { id: 'code', header: 'Code', render: (item) => item.code },
                    { id: 'status', header: 'Status', render: (item) => <INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus> },
                  ]}
                  selectedId={form.resourceId}
                  onSelect={(id) => setForm({ ...form, resourceId: id })}
                  search={scopeSearch}
                  ariaLabel={form.scopeType === 'organization' ? 'Organization scope browser' : 'Location scope browser'}
                  emptyContent={scopeSearch ? 'No hierarchy resources match this search.' : 'No hierarchy resources are available.'}
                />
              ) : null}
            </INNOCollection>
          ) : null}

          {save.isError ? <ErrorState error={save.error} /> : null}
          <INNOEditorFooter>
            <INNOEditorFooterStart><INNOButton type="button" variant="secondary" disabled={save.isPending} onClick={() => navigate('/admin/access-scopes')}>Cancel</INNOButton></INNOEditorFooterStart>
            <INNOEditorFooterEnd><INNOButton type="submit" busy={save.isPending}>Save Assignment</INNOButton></INNOEditorFooterEnd>
          </INNOEditorFooter>
        </form>
      </section>
    </INNOPage>
  );
}
