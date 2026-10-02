import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState,
  INNOCollectionToolbar, INNOPage, INNOSearchField, INNOSelectField,
  INNOStatus, INNOTableWrap,
} from '@inno/ui';
import {
  evaluateAdminAccess, getAdminAccessAssignments, getAdminPermissions,
  getAdminRoles, getAdminUsers,
} from '../api/client';
import type { AdminAccessEvaluation } from '../api/types';
import { CollectionErrorState, CollectionLoadingState, ErrorState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

export function AdminAccessScopesPage() {
  const canManage = usePermission('admin.access_scopes.manage');
  const canEvaluate = usePermission('admin.access_scopes.evaluate');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [evaluateUserId, setEvaluateUserId] = useState('');
  const [evaluatePermission, setEvaluatePermission] = useState('');
  const [evaluation, setEvaluation] = useState<AdminAccessEvaluation | null>(null);
  const assignments = useQuery({ queryKey: ['admin', 'access-assignments'], queryFn: getAdminAccessAssignments });
  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: getAdminRoles });
  const permissions = useQuery({ queryKey: ['admin', 'permissions'], queryFn: getAdminPermissions });
  const users = useQuery({ queryKey: ['admin', 'users', 'scope-picker'], queryFn: () => getAdminUsers({ page: 1, pageSize: 100 }) });

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

  const evaluate = useMutation({
    mutationFn: () => evaluateAdminAccess({ userId: evaluateUserId, permission: evaluatePermission }),
    onSuccess: setEvaluation,
  });

  return (
    <INNOPage
      eyebrow="Admin Center · Access"
      title="Access Scopes"
      description="Manage role + resource-scope bindings separately from role definitions."
    >
      <INNOCollection>
        <INNOCollectionHeader
          title="Access Assignments"
          description="Role + resource scope bindings. Assignment creation is not part of the current API contract."
          meta={assignments.data ? <INNOStatus>{assignments.data.length} assignments</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search assignments" value={search} onChange={setSearch} placeholder="Search user, role or scope…" />
          <INNOSelectField label="Role filter" value={roleFilter} onChange={setRoleFilter}>
            <option value="all">Role: All</option>
            {roles.data?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </INNOSelectField>
        </INNOCollectionToolbar>
        {assignments.isPending ? <CollectionLoadingState label="Loading access assignments…" /> : null}
        {assignments.isError ? <CollectionErrorState error={assignments.error} retry={() => void assignments.refetch()} /> : null}
        {assignments.data && filtered.length === 0 ? (
          <INNOCollectionState
            kind={search || roleFilter !== 'all' ? 'no-results' : 'empty'}
            title={search || roleFilter !== 'all' ? 'No assignments found' : 'No access assignments'}
            description={search || roleFilter !== 'all' ? 'Try another search or clear the filters.' : 'No assignments are currently visible.'}
            action={search || roleFilter !== 'all'
              ? <INNOButton variant="secondary" onClick={() => { setSearch(''); setRoleFilter('all'); }}>Clear filters</INNOButton>
              : undefined}
          />
        ) : null}
        {filtered.length ? (
          <INNOTableWrap width="wide" stickyAction>
            <table>
              <thead><tr><th>Subject</th><th>Role</th><th>Scope</th><th>Resources</th><th>Status</th><th className="action-column">Action</th></tr></thead>
              <tbody>{filtered.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.subjectName}</b></td>
                  <td>{item.roleName}</td>
                  <td>{item.scopeType}</td>
                  <td>{item.resources.length ? item.resources.map((resource) => resource.id).join(', ') : 'All'}</td>
                  <td><INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus></td>
                  <td className="action-column">
                    {canManage
                      ? <Link className="inno-row-action" to={'/admin/access-scopes/' + item.id + '/edit'} aria-label={'Edit assignment for ' + item.subjectName}>Edit</Link>
                      : <span className="table-meta">View only</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </INNOTableWrap>
        ) : null}
      </INNOCollection>
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
