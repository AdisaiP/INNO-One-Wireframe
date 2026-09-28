import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { INNOCollection, INNOCollectionHeader, INNOCollectionToolbar, INNOPage, INNOSearchField, INNOState, INNOStatus, INNOTableWrap } from '@inno/ui';
import { getAdminPermissions, getAdminRoles } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

export function AdminRolesPage() {
  const [search, setSearch] = useState('');
  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: getAdminRoles });
  const permissions = useQuery({ queryKey: ['admin', 'permissions'], queryFn: getAdminPermissions });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (permissions.data ?? []).filter((permission) =>
      !term
      || permission.id.toLowerCase().includes(term)
      || permission.name.toLowerCase().includes(term)
      || permission.module.toLowerCase().includes(term),
    );
  }, [permissions.data, search]);

  return (
    <INNOPage
      eyebrow="Admin Center · Access"
      title="Roles & Permissions"
      description="Inspect centralized RBAC while modules continue to own their permission contracts."
    >
      <INNOState
        compact
        title="Role definitions are read-only in this phase"
        description="The current API contract exposes role and permission catalogs, but does not define role create/update operations. No fake Edit action is shown."
      />

      <INNOCollection>
        <INNOCollectionHeader
          title="Role catalog"
          description="Reusable role definitions currently available for access assignments."
          meta={roles.data ? <INNOStatus>{roles.data.length} roles</INNOStatus> : undefined}
        />
        {roles.isPending ? <div className="collection-state"><LoadingState label="Loading roles…" /></div> : null}
        {roles.isError ? <div className="collection-state"><ErrorState error={roles.error} retry={() => void roles.refetch()} /></div> : null}
        {roles.data?.length ? (
          <div className="admin-role-grid">
            {roles.data.map((role) => (
              <article className="admin-role-card" key={role.id}>
                <div><b>{role.name}</b><span>{role.code}</span></div>
                <INNOStatus tone={role.status === 'active' ? 'success' : 'neutral'}>{role.status}</INNOStatus>
                <small>{role.permissions.length} permissions</small>
              </article>
            ))}
          </div>
        ) : roles.data ? <div className="collection-state"><INNOState title="No roles available" /></div> : null}
      </INNOCollection>

      <INNOCollection>
        <INNOCollectionHeader
          title="Permission matrix"
          description="A check means the role currently includes the permission."
          meta={permissions.data ? <INNOStatus>{permissions.data.length} permissions</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search permissions" value={search} onChange={setSearch} placeholder="Search permission, module or description…" />
        </INNOCollectionToolbar>
        {permissions.isPending ? <div className="collection-state"><LoadingState label="Loading permissions…" /></div> : null}
        {permissions.isError ? <div className="collection-state"><ErrorState error={permissions.error} retry={() => void permissions.refetch()} /></div> : null}
        {permissions.data && filtered.length === 0 ? <div className="collection-state"><INNOState kind="no-results" title="No permissions found" description="Try another search." /></div> : null}
        {filtered.length ? (
          <INNOTableWrap width="xwide">
            <table className="admin-permission-matrix">
              <thead>
                <tr><th>Permission</th><th>Module</th>{roles.data?.map((role) => <th key={role.id}>{role.name}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((permission) => (
                  <tr key={permission.id}>
                    <td><b>{permission.id}</b><div className="table-meta">{permission.name}</div></td>
                    <td>{permission.module}</td>
                    {roles.data?.map((role) => <td key={role.id} className="admin-permission-cell">{role.permissions.includes(permission.id) ? '✓' : '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        ) : null}
      </INNOCollection>
    </INNOPage>
  );
}
