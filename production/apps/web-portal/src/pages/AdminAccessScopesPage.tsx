import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RouterRowAction } from '../components/RouterRowAction';
import {
  INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState,
  INNOCollectionToolbar, INNODialog, INNOPage, INNOSearchField, INNOSelectField,
  INNOStatus, INNOTableWrap,
} from '@inno/ui';
import {
  evaluateAdminAccess, getAdminAccessAssignments, getAdminPermissions,
  getAdminRoles, getAdminUsers,
} from '../api/client';
import type { AdminAccessEvaluation } from '../api/types';
import { CollectionErrorState, CollectionLoadingState, ErrorState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

export function AdminAccessScopesPage() {
  const { t: t45n } = useStep45NI18n();
  const canManage = usePermission('admin.access_scopes.manage');
  const canEvaluate = usePermission('admin.access_scopes.evaluate');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [evaluateOpen, setEvaluateOpen] = useState(false);
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
      eyebrow={t45n('admin.step45n.adminAccessScopeEdit.adminCenterAccess')}
      title={t45n('navigation.accessScopes')}
      description={t45n('admin.step45n.adminAccessScopes.manageWhoReceivesARoleAndWhichResources')}
      actions={canEvaluate ? (
        <INNOButton type="button" variant="secondary" onClick={() => setEvaluateOpen(true)}>{t45n('admin.step45n.adminAccessScopes.evaluateAccess')}</INNOButton>
      ) : undefined}
    >
      <INNOCollection>
        <INNOCollectionHeader
          title={t45n('admin.step45n.adminAccessScopes.accessAssignments')}
          description={t45n('admin.step45n.adminAccessScopes.roleResourceScopeBindingsAssignmentCreationIsNot')}
          meta={assignments.data ? <INNOStatus>{assignments.data.length} {t45n('admin.step45n.adminAccessScopes.assignments')}</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label={t45n('admin.step45n.adminAccessScopes.searchAssignments')} value={search} onChange={setSearch} placeholder={t45n('admin.step45n.adminAccessScopes.searchUserRoleOrScope')} />
          <INNOSelectField label={t45n('admin.step45n.adminAccessScopes.roleFilter')} value={roleFilter} onChange={setRoleFilter}>
            <option value="all">{t45n('admin.step45n.adminAccessScopes.roleAll')}</option>
            {roles.data?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </INNOSelectField>
        </INNOCollectionToolbar>
        {assignments.isPending ? <CollectionLoadingState label={t45n('admin.step45n.adminAccessScopes.loadingAccessAssignments')} /> : null}
        {assignments.isError ? <CollectionErrorState error={assignments.error} retry={() => void assignments.refetch()} /> : null}
        {assignments.data && filtered.length === 0 ? (
          <INNOCollectionState
            kind={search || roleFilter !== 'all' ? 'no-results' : 'empty'}
            title={search || roleFilter !== 'all' ? t45n('admin.step45n.adminAccessScopes.noAssignmentsFound') : t45n('admin.step45n.adminAccessScopes.noAccessAssignments')}
            description={search || roleFilter !== 'all' ? t45n('admin.step45n.adminAccessScopes.tryAnotherSearchOrClearTheFilters') : t45n('admin.step45n.adminAccessScopes.noAssignmentsAreCurrentlyVisible')}
            action={search || roleFilter !== 'all'
              ? <INNOButton variant="secondary" onClick={() => { setSearch(''); setRoleFilter('all'); }}>{t45n('admin.step45n.adminAccessScopes.clearFilters')}</INNOButton>
              : undefined}
          />
        ) : null}
        {filtered.length ? (
          <INNOTableWrap width="wide" stickyAction>
            <table>
              <thead><tr><th>{t45n('reports.column.subject')}</th><th>{t45n('admin.step45n.adminAccessScopeEdit.role')}</th><th>{t45n('admin.step45n.adminAccessScopes.scope')}</th><th>{t45n('admin.step45n.adminAccessScopes.resources')}</th><th>{t45n('reports.runs.status')}</th><th className="action-column">{t45n('reports.table.action')}</th></tr></thead>
              <tbody>{filtered.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.subjectName}</b></td>
                  <td>{item.roleName}</td>
                  <td>{item.scopeType}</td>
                  <td>{item.resources.length ? item.resources.map((resource) => resource.id).join(', ') : t45n('admin.step45n.adminAccessScopeEdit.all')}</td>
                  <td><INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus></td>
                  <td className="action-column">
                    {canManage
                      ? <RouterRowAction to={'/admin/access-scopes/' + item.id + '/edit'} label={t45n('reports.action.edit')} ariaLabel={t45n('admin.step45n.adminAccessScopes.editAssignmentFor') + ' ' + item.subjectName} />
                      : <span className="table-meta">{t45n('admin.step45n.adminAccessScopes.viewOnly')}</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </INNOTableWrap>
        ) : null}
      </INNOCollection>

      <INNODialog
        open={evaluateOpen}
        title={t45n('admin.step45n.adminAccessScopes.evaluateAccess')}
        description={t45n('admin.step45n.adminAccessScopes.checkWhetherOneUserHasAPermissionAnd')}
        onClose={() => setEvaluateOpen(false)}
        size="md"
        footer={(
          <>
            <INNOButton type="button" variant="secondary" onClick={() => setEvaluateOpen(false)}>{t45n('admin.step45n.adminAccessScopes.close')}</INNOButton>
            <INNOButton
              type="button"
              busy={evaluate.isPending}
              disabled={!canEvaluate || !evaluateUserId || !evaluatePermission}
              onClick={() => evaluate.mutate()}
            >
              {t45n('admin.step45n.adminAccessScopes.evaluate')}</INNOButton>
          </>
        )}
      >
        <div className="admin-evaluate-dialog">
          <label className="field-block">
            <span>{t45n('common.user')}</span>
            <select value={evaluateUserId} onChange={(e) => { setEvaluateUserId(e.target.value); setEvaluation(null); }}>
              <option value="">{t45n('admin.step45n.adminAccessScopes.selectUser')}</option>
              {users.data?.items.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
            </select>
          </label>
          <label className="field-block">
            <span>{t45n('admin.step45n.adminAccessScopes.permission')}</span>
            <select value={evaluatePermission} onChange={(e) => { setEvaluatePermission(e.target.value); setEvaluation(null); }}>
              <option value="">{t45n('admin.step45n.adminAccessScopes.selectPermission')}</option>
              {permissions.data?.map((permission) => <option key={permission.id} value={permission.id}>{permission.id}</option>)}
            </select>
          </label>
          {evaluate.isError ? <ErrorState error={evaluate.error} /> : null}
          {evaluation ? (
            <div className="admin-evaluation-result">
              <INNOStatus tone={evaluation.allowed ? 'success' : 'danger'}>{evaluation.allowed ? t45n('admin.step45n.adminAccessScopes.allowed') : t45n('admin.step45n.adminAccessScopes.denied')}</INNOStatus>
              <div><b>{evaluation.permission}</b><span>{evaluation.reason}</span></div>
              <small>{evaluation.allResources ? t45n('admin.step45n.adminAccessScopes.allResources') : [
                evaluation.organizationIds.length ? evaluation.organizationIds.length + ' organizations' : '',
                evaluation.locationIds.length ? evaluation.locationIds.length + ' locations' : '',
                evaluation.deviceGroupIds.length ? evaluation.deviceGroupIds.length + ' device groups' : '',
              ].filter(Boolean).join(' · ') || t45n('admin.step45n.adminAccessScopes.noResourceScope')}</small>
            </div>
          ) : null}
        </div>
      </INNODialog>
    </INNOPage>
  );
}
