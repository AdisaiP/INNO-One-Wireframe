import { useDeferredValue, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOIcon,
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionToolbar,
  INNOEditorFooter,
  INNOPage,
  INNOPagination,
  INNOSearchField,
  INNOSelectField,
  INNOState,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import {
  createAdminUser,
  getAdminLocations,
  getAdminOrganizationTree,
  getAdminPositions,
  getAdminUsers,
} from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

const blankForm = {
  keycloakSubject: '',
  employeeId: '',
  fullName: '',
  email: '',
  phone: '',
  office: '',
  organizationId: '',
  positionId: '',
  locationId: '',
  status: 'active',
};

export function AdminUsersPage() {
  const canManage = usePermission('admin.users.manage');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState('all');
  const [organizationId, setOrganizationId] = useState('all');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(blankForm);

  useEffect(() => setPage(1), [deferredSearch, status, organizationId]);

  const users = useQuery({
    queryKey: ['admin', 'users', page, deferredSearch, status, organizationId],
    queryFn: () => getAdminUsers({ page, pageSize: 25, search: deferredSearch, status, organizationId }),
  });
  const organizations = useQuery({ queryKey: ['admin', 'organization'], queryFn: getAdminOrganizationTree });
  const locations = useQuery({ queryKey: ['admin', 'location'], queryFn: getAdminLocations });
  const positions = useQuery({ queryKey: ['admin', 'positions'], queryFn: getAdminPositions });

  const create = useMutation({
    mutationFn: () => createAdminUser({
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
    }),
    onSuccess: async () => {
      setShowCreate(false);
      setForm(blankForm);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
      ]);
    },
  });

  return (
    <INNOPage
      eyebrow="Admin Center · Organization"
      title="Users"
      description="Browse organization profiles separately from authentication identity."
      actions={canManage ? (
        <INNOButton type="button" onClick={() => setShowCreate((value) => !value)}>
          {showCreate ? 'Cancel' : 'New User'}
        </INNOButton>
      ) : undefined}
    >
      {showCreate ? (
        <section className="prod-panel create-panel">
          <div className="prod-panel-head"><div><h3>New User Profile</h3><p>Link an existing Keycloak identity to an INNO.One organization profile.</p></div></div>
          <form className="editor-form" onSubmit={(event) => { event.preventDefault(); if (!create.isPending) create.mutate(); }}>
            <div className="editor-grid">
              <label className="field-block"><span>Keycloak subject</span><input required value={form.keycloakSubject} onChange={(e) => setForm({ ...form, keycloakSubject: e.target.value })} /></label>
              <label className="field-block"><span>Employee ID</span><input required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></label>
              <label className="field-block"><span>Full name</span><input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
              <label className="field-block"><span>Email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label className="field-block"><span>Organization unit</span><select value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}><option value="">Unassigned</option>{organizations.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="field-block"><span>Position</span><select value={form.positionId} onChange={(e) => setForm({ ...form, positionId: e.target.value })}><option value="">Unassigned</option>{positions.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="field-block"><span>Location</span><select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}><option value="">Unassigned</option>{locations.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="field-block"><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            </div>
            {create.isError ? <ErrorState error={create.error} /> : null}
            <INNOEditorFooter><INNOButton type="submit" busy={create.isPending} disabled={!form.keycloakSubject.trim() || !form.employeeId.trim() || !form.fullName.trim() || !form.email.trim()}>Create User</INNOButton></INNOEditorFooter>
          </form>
        </section>
      ) : null}

      <INNOCollection>
        <INNOCollectionHeader
          title="User directory"
          description="Authentication identity is separate from the organization profile."
          meta={users.data ? <INNOStatus>{users.data.totalItems} users</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search users" value={search} onChange={setSearch} placeholder="Search name, employee ID or email…" />
          <INNOSelectField label="User status" value={status} onChange={setStatus}><option value="all">Status: All</option><option value="active">Active</option><option value="inactive">Inactive</option></INNOSelectField>
          <INNOSelectField label="Organization unit" value={organizationId} onChange={setOrganizationId}><option value="all">Unit: All</option>{organizations.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</INNOSelectField>
        </INNOCollectionToolbar>

        {users.isPending ? <div className="collection-state"><LoadingState label="Loading users…" /></div> : null}
        {users.isError ? <div className="collection-state"><ErrorState error={users.error} retry={() => void users.refetch()} /></div> : null}
        {users.data?.items.length === 0 ? <div className="collection-state"><INNOState kind={search || status !== 'all' || organizationId !== 'all' ? 'no-results' : 'empty'} title="No users found" description="Try another search or filter." /></div> : null}
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
            <INNOPagination page={users.data.page} totalPages={users.data.totalPages} totalItems={users.data.totalItems} pageSize={users.data.pageSize} onPageChange={setPage} />
          </>
        ) : null}
      </INNOCollection>
    </INNOPage>
  );
}
