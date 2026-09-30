import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  INNOIcon,
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionToolbar,
  INNOEditorFooter,
  INNOPage,
  INNOSearchField,
  INNOSelectField,
  INNOState,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import {
  evaluateAdminAccess,
  getAdminAccessAssignments,
  getAdminLocations,
  getAdminOrganizationTree,
  getAdminPermissions,
  getAdminRoles,
  getAdminUsers,
  updateAdminAccessAssignment,
} from '../api/client';
import type { AdminAccessAssignment, AdminAccessEvaluation } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

export function AdminAccessScopesPage() {
  const canManage = usePermission('admin.access_scopes.manage');
  const canEvaluate = usePermission('admin.access_scopes.evaluate');
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(params.get('assignment') ?? '');
  const [evaluateUserId, setEvaluateUserId] = useState('');
  const [evaluatePermission, setEvaluatePermission] = useState('');
  const [evaluation, setEvaluation] = useState<AdminAccessEvaluation | null>(null);
  const [form, setForm] = useState({
    roleId: '',
    scopeType: 'all',
    resourceId: '',
    includeChildren: false,
    actionOverrides: '',
    status: 'active',
  });

  const assignments = useQuery({ queryKey: ['admin', 'access-assignments'], queryFn: getAdminAccessAssignments });
  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: getAdminRoles });
  const permissions = useQuery({ queryKey: ['admin', 'permissions'], queryFn: getAdminPermissions });
  const organizations = useQuery({ queryKey: ['admin', 'organization'], queryFn: getAdminOrganizationTree });
  const locations = useQuery({ queryKey: ['admin', 'location'], queryFn: getAdminLocations });
  const users = useQuery({ queryKey: ['admin', 'users', 'scope-picker'], queryFn: () => getAdminUsers({ page: 1, pageSize: 100 }) });

  const selected = assignments.data?.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('assignment', selected.id);
      return next;
    }, { replace: true });
    setForm({
      roleId: selected.roleId,
      scopeType: selected.scopeType,
      resourceId: selected.resources[0]?.id ?? '',
      includeChildren: selected.includeChildren,
      actionOverrides: selected.actionOverrides.join(', '),
      status: selected.status,
    });
  }, [selected, setParams]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (assignments.data ?? []).filter((item) => {
      const matchesTerm = !term
        || item.subjectName.toLowerCase().includes(term)
        || item.roleName.toLowerCase().includes(term)
        || item.scopeType.toLowerCase().includes(term);
      return matchesTerm && (roleFilter === 'all' || item.roleId === roleFilter);
    });
  }, [assignments.data, roleFilter, search]);

  const save = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Select an access assignment.');
      return updateAdminAccessAssignment(selected.id, selected.eTag, {
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
        queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
      ]);
    },
  });

  const evaluate = useMutation({
    mutationFn: () => evaluateAdminAccess({ userId: evaluateUserId, permission: evaluatePermission }),
    onSuccess: setEvaluation,
  });

  const scopeOptions = form.scopeType === 'organization'
    ? organizations.data ?? []
    : form.scopeType === 'location'
      ? locations.data ?? []
      : [];

  function selectAssignment(item: AdminAccessAssignment) {
    setSelectedId(item.id);
    setEvaluation(null);
  }

  return (
    <INNOPage
      eyebrow="Admin Center · Access"
      title="Access Scopes"
      description="Manage role + resource-scope bindings separately from role definitions."
    >
      <div className="admin-master-detail admin-access-layout">
        <INNOCollection>
          <INNOCollectionHeader title="Access Assignments" description="Role + resource scope bindings." meta={assignments.data ? <INNOStatus>{assignments.data.length} assignments</INNOStatus> : undefined} />
          <INNOCollectionToolbar>
            <INNOSearchField label="Search assignments" value={search} onChange={setSearch} placeholder="Search user, role or scope…" />
            <INNOSelectField label="Role filter" value={roleFilter} onChange={setRoleFilter}><option value="all">Role: All</option>{roles.data?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</INNOSelectField>
          </INNOCollectionToolbar>
          {assignments.isPending ? <div className="collection-state"><LoadingState label="Loading access assignments…" /></div> : null}
          {assignments.isError ? <div className="collection-state"><ErrorState error={assignments.error} retry={() => void assignments.refetch()} /></div> : null}
          {assignments.data && filtered.length === 0 ? <div className="collection-state"><INNOState kind={search || roleFilter !== 'all' ? 'no-results' : 'empty'} title="No assignments found" description="The current API contract does not define assignment creation, so only existing assignments are shown." /></div> : null}
          {filtered.length ? (
            <INNOTableWrap width="wide">
              <table>
                <thead><tr><th>Subject</th><th>Role</th><th>Scope</th><th>Resources</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>{filtered.map((item) => <tr key={item.id} className={item.id === selectedId ? 'selected-row' : undefined}><td><b>{item.subjectName}</b></td><td>{item.roleName}</td><td>{item.scopeType}</td><td>{item.resources.length ? item.resources.map((resource) => resource.id).join(', ') : 'All'}</td><td><INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus></td><td className="action-column"><button type="button" className="device-row-action" aria-label={'Open assignment for ' + item.subjectName} onClick={() => selectAssignment(item)}><INNOIcon token="action.next" size={14} /></button></td></tr>)}</tbody>
              </table>
            </INNOTableWrap>
          ) : null}
        </INNOCollection>

        <section className="prod-panel admin-editor-panel">
          <div className="prod-panel-head"><div><h3>{selected ? selected.subjectName : 'Assignment details'}</h3><p>{selected ? 'Edit this existing role + scope binding.' : 'Select an assignment to inspect or edit it.'}</p></div></div>
          {selected ? (
            <form className="editor-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
              <div className="editor-grid">
                <label className="field-block"><span>Role</span><select disabled={!canManage} value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>{roles.data?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
                <label className="field-block"><span>Scope type</span><select disabled={!canManage} value={form.scopeType} onChange={(e) => setForm({ ...form, scopeType: e.target.value, resourceId: '' })}><option value="all">All</option><option value="organization">Organization</option><option value="location">Location</option><option value="device_group">Device Group</option></select></label>
                {form.scopeType === 'organization' || form.scopeType === 'location' ? (
                  <label className="field-block"><span>Resource</span><select disabled={!canManage} value={form.resourceId} onChange={(e) => setForm({ ...form, resourceId: e.target.value })}><option value="">Select resource</option>{scopeOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                ) : null}
                {form.scopeType === 'device_group' ? <label className="field-block"><span>Device Group ID</span><input disabled={!canManage} value={form.resourceId} onChange={(e) => setForm({ ...form, resourceId: e.target.value })} placeholder="grp_…" /></label> : null}
                <label className="field-block"><span>Status</span><select disabled={!canManage} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                <label className="field-block field-wide"><span>Action overrides</span><input disabled={!canManage} value={form.actionOverrides} onChange={(e) => setForm({ ...form, actionOverrides: e.target.value })} placeholder="permission.id, permission.id" /></label>
                <label className="field-block admin-check-field"><input type="checkbox" disabled={!canManage || form.scopeType === 'all'} checked={form.includeChildren} onChange={(e) => setForm({ ...form, includeChildren: e.target.checked })} /><span>Include child resources</span></label>
              </div>
              {save.isError ? <ErrorState error={save.error} /> : null}
              {canManage ? <INNOEditorFooter><INNOButton type="submit" busy={save.isPending}>Save Assignment</INNOButton></INNOEditorFooter> : null}
            </form>
          ) : <div className="collection-state"><INNOState title="Select an assignment" description="Choose a row to inspect its role and effective resource scope." /></div>}
        </section>
      </div>

      <INNOCollection>
        <INNOCollectionHeader title="Evaluate Access" description="Explain whether a user has one permission and which scope made it effective." />
        <div className="admin-evaluate-panel">
          <label className="field-block"><span>User</span><select disabled={!canEvaluate} value={evaluateUserId} onChange={(e) => setEvaluateUserId(e.target.value)}><option value="">Select user</option>{users.data?.items.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}</select></label>
          <label className="field-block"><span>Permission</span><select disabled={!canEvaluate} value={evaluatePermission} onChange={(e) => setEvaluatePermission(e.target.value)}><option value="">Select permission</option>{permissions.data?.map((permission) => <option key={permission.id} value={permission.id}>{permission.id}</option>)}</select></label>
          <INNOButton type="button" busy={evaluate.isPending} disabled={!canEvaluate || !evaluateUserId || !evaluatePermission} onClick={() => evaluate.mutate()}>Evaluate</INNOButton>
        </div>
        {evaluate.isError ? <div className="collection-state"><ErrorState error={evaluate.error} /></div> : null}
        {evaluation ? (
          <div className="admin-evaluation-result">
            <INNOStatus tone={evaluation.allowed ? 'success' : 'danger'}>{evaluation.allowed ? 'Allowed' : 'Denied'}</INNOStatus>
            <div><b>{evaluation.permission}</b><span>{evaluation.reason}</span></div>
            <small>{evaluation.allResources ? 'All resources' : [
              evaluation.organizationIds.length ? evaluation.organizationIds.length + ' organizations' : '',
              evaluation.locationIds.length ? evaluation.locationIds.length + ' locations' : '',
              evaluation.deviceGroupIds.length ? evaluation.deviceGroupIds.length + ' device groups' : '',
            ].filter(Boolean).join(' · ') || 'No resource scope'}</small>
          </div>
        ) : null}
      </INNOCollection>
    </INNOPage>
  );
}
