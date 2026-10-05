import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState,
  INNOCollectionToolbar, INNOPage, INNOPagination, INNOSearchField,
  INNOSelectField, INNOStatus, INNOTableWrap,
} from '@inno/ui';
import { getAdminOrganizationTree, getAdminUsers } from '../api/client';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import { RouterRowAction } from '../components/RouterRowAction';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

export function AdminUsersPage() {
  const { t: t45n } = useStep45NI18n();
  const canManage = usePermission('admin.users.manage');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState('all');
  const [organizationId, setOrganizationId] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [deferredSearch, status, organizationId]);

  const users = useQuery({
    queryKey: ['admin', 'users', page, deferredSearch, status, organizationId],
    queryFn: () => getAdminUsers({ page, pageSize: 25, search: deferredSearch, status, organizationId }),
  });
  const organizations = useQuery({ queryKey: ['admin', 'organization'], queryFn: getAdminOrganizationTree });
  return (
    <INNOPage
      eyebrow={t45n('admin.step45n.adminHierarchy.adminCenterOrganization')}
      title={t45n('navigation.users')}
      description={t45n('admin.step45n.adminUsers.browseOrganizationProfilesSeparatelyFromAuthenticationIdentity')}
      actions={canManage ? <Link className="inno-btn inno-btn-primary" to="/admin/users/new">{t45n('admin.step45n.adminUsers.newUser')}</Link> : undefined}
    >
      <INNOCollection>
        <INNOCollectionHeader
          title={t45n('admin.step45n.adminUsers.userDirectory')}
          description={t45n('admin.step45n.adminUsers.authenticationIdentityIsSeparateFromTheOrganizationProfile')}
          meta={users.data ? <INNOStatus>{users.data.totalItems} {t45n('admin.step45n.adminUsers.users')}</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label={t45n('admin.step45n.adminUsers.searchUsers')} value={search} onChange={setSearch} placeholder={t45n('admin.step45n.adminUsers.searchNameEmployeeIdOrEmail')} />
          <INNOSelectField label={t45n('admin.step45n.adminUsers.userStatus')} value={status} onChange={setStatus}>
            <option value="all">{t45n('admin.step45n.adminUsers.statusAll')}</option><option value="active">{t45n('reports.status.active')}</option><option value="inactive">{t45n('admin.step45n.adminAccessScopeEdit.inactive')}</option>
          </INNOSelectField>
          <INNOSelectField label={t45n('admin.step45n.adminUserEditor.organizationUnit')} value={organizationId} onChange={setOrganizationId}>
            <option value="all">{t45n('admin.step45n.adminUsers.unitAll')}</option>
            {organizations.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </INNOSelectField>
        </INNOCollectionToolbar>
        {users.isPending ? <CollectionLoadingState label={t45n('admin.step45n.adminUsers.loadingUsers')} /> : null}
        {users.isError ? <CollectionErrorState error={users.error} retry={() => void users.refetch()} /> : null}
        {users.data?.items.length === 0 ? (
          <INNOCollectionState
            kind={search || status !== 'all' || organizationId !== 'all' ? 'no-results' : 'empty'}
            title={search || status !== 'all' || organizationId !== 'all' ? t45n('admin.step45n.adminUsers.noUsersFound') : t45n('admin.step45n.adminUsers.noUsersInScope')}
            description={search || status !== 'all' || organizationId !== 'all'
              ? t45n('admin.step45n.adminAccessScopes.tryAnotherSearchOrClearTheFilters')
              : t45n('admin.step45n.adminUsers.noOrganizationProfileIsCurrentlyVisibleInYour')}
            action={search || status !== 'all' || organizationId !== 'all'
              ? <INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setOrganizationId('all'); }}>{t45n('admin.step45n.adminAccessScopes.clearFilters')}</INNOButton>
              : undefined}
          />
        ) : null}
        {users.data?.items.length ? (
          <>
            <INNOTableWrap width="wide">
              <table>
                <thead><tr><th>{t45n('common.user')}</th><th>{t45n('profile.employeeId')}</th><th>{t45n('profile.organization')}</th><th>{t45n('admin.step45n.adminPositions.position')}</th><th>{t45n('profile.location')}</th><th>{t45n('reports.runs.status')}</th><th className="action-column">{t45n('reports.table.action')}</th></tr></thead>
                <tbody>{users.data.items.map((user) => (
                  <tr key={user.id}>
                    <td><b>{user.fullName}</b><div className="table-meta">{user.email}</div></td>
                    <td>{user.employeeId}</td>
                    <td>{user.organization?.name ?? '—'}</td>
                    <td>{user.position?.name ?? '—'}</td>
                    <td>{user.location?.name ?? '—'}</td>
                    <td><INNOStatus tone={user.status === 'active' ? 'success' : 'neutral'}>{user.status}</INNOStatus></td>
                    <td className="action-column"><RouterRowAction to={'/admin/users/' + user.id} ariaLabel={t45n('common.step45n.search.open') + ' ' + user.fullName} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </INNOTableWrap>
            <INNOPagination
              page={users.data.page}
              totalPages={users.data.totalPages}
              totalItems={users.data.totalItems}
              pageSize={users.data.pageSize}
              onPageChange={setPage}
            />
          </>
        ) : null}
      </INNOCollection>
    </INNOPage>
  );
}
