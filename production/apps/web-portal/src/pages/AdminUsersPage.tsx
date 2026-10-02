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
import { usePermission } from '../app/ProfileContext';

export function AdminUsersPage() {
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
      eyebrow="Admin Center · Organization"
      title="Users"
      description="Browse organization profiles separately from authentication identity."
      actions={canManage ? <Link className="inno-btn inno-btn-primary" to="/admin/users/new">New User</Link> : undefined}
    >
      <INNOCollection>
        <INNOCollectionHeader
          title="User directory"
          description="Authentication identity is separate from the organization profile."
          meta={users.data ? <INNOStatus>{users.data.totalItems} users</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search users" value={search} onChange={setSearch} placeholder="Search name, employee ID or email…" />
          <INNOSelectField label="User status" value={status} onChange={setStatus}>
            <option value="all">Status: All</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </INNOSelectField>
          <INNOSelectField label="Organization unit" value={organizationId} onChange={setOrganizationId}>
            <option value="all">Unit: All</option>
            {organizations.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </INNOSelectField>
        </INNOCollectionToolbar>
        {users.isPending ? <CollectionLoadingState label="Loading users…" /> : null}
        {users.isError ? <CollectionErrorState error={users.error} retry={() => void users.refetch()} /> : null}
        {users.data?.items.length === 0 ? (
          <INNOCollectionState
            kind={search || status !== 'all' || organizationId !== 'all' ? 'no-results' : 'empty'}
            title={search || status !== 'all' || organizationId !== 'all' ? 'No users found' : 'No users in scope'}
            description={search || status !== 'all' || organizationId !== 'all'
              ? 'Try another search or clear the filters.'
              : 'No organization profile is currently visible in your scope.'}
            action={search || status !== 'all' || organizationId !== 'all'
              ? <INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setOrganizationId('all'); }}>Clear filters</INNOButton>
              : undefined}
          />
        ) : null}
        {users.data?.items.length ? (
          <>
            <INNOTableWrap width="wide">
              <table>
                <thead><tr><th>User</th><th>Employee ID</th><th>Organization</th><th>Position</th><th>Location</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>{users.data.items.map((user) => (
                  <tr key={user.id}>
                    <td><b>{user.fullName}</b><div className="table-meta">{user.email}</div></td>
                    <td>{user.employeeId}</td>
                    <td>{user.organization?.name ?? '—'}</td>
                    <td>{user.position?.name ?? '—'}</td>
                    <td>{user.location?.name ?? '—'}</td>
                    <td><INNOStatus tone={user.status === 'active' ? 'success' : 'neutral'}>{user.status}</INNOStatus></td>
                    <td className="action-column"><Link className="inno-row-action" to={'/admin/users/' + user.id} aria-label={'Open ' + user.fullName}>Open</Link></td>
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
