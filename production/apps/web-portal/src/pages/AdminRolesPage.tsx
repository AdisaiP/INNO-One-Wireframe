import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState,
  INNOCollectionToolbar, INNODrawer, INNOIcon, INNOPage, INNORowActions,
  INNOSearchField, INNOStatus, INNOTableWrap,
} from '@inno/ui';
import {
  createAdminRole, getAdminPermissions, getAdminRoles, updateAdminRole,
} from '../api/client';
import type { AdminRole } from '../api/types';
import { CollectionErrorState, CollectionLoadingState, ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

const blankForm = { code: '', name: '', status: 'active', permissions: [] as string[] };
const protectedPlatformAdminPermissions = new Set(['admin.access', 'admin.roles.view', 'admin.roles.manage']);

export function AdminRolesPage() {
  const canManage = usePermission('admin.roles.manage');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [permissionSearch, setPermissionSearch] = useState('');
  const [editorPermissionSearch, setEditorPermissionSearch] = useState('');
  const [mode, setMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<AdminRole | null>(null);
  const [form, setForm] = useState(blankForm);

  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: getAdminRoles });
  const permissions = useQuery({ queryKey: ['admin', 'permissions'], queryFn: getAdminPermissions });

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (roles.data ?? []).filter((role) =>
      !term
      || role.name.toLowerCase().includes(term)
      || role.code.toLowerCase().includes(term));
  }, [roles.data, search]);

  const filteredPermissions = useMemo(() => {
    const term = permissionSearch.trim().toLowerCase();
    return (permissions.data ?? []).filter((permission) =>
      !term
      || permission.id.toLowerCase().includes(term)
      || permission.name.toLowerCase().includes(term)
      || permission.module.toLowerCase().includes(term));
  }, [permissions.data, permissionSearch]);

  const editorGroups = useMemo(() => {
    const term = editorPermissionSearch.trim().toLowerCase();
    const grouped = new Map<string, typeof filteredPermissions>();
    for (const permission of permissions.data ?? []) {
      if (term
        && !permission.id.toLowerCase().includes(term)
        && !permission.name.toLowerCase().includes(term)
        && !permission.module.toLowerCase().includes(term)) continue;
      const group = grouped.get(permission.module) ?? [];
      group.push(permission);
      grouped.set(permission.module, group);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions.data, editorPermissionSearch]);

  function openCreate() {
    setEditing(null);
    setForm(blankForm);
    setEditorPermissionSearch('');
    setMode('create');
  }

  function openEdit(role: AdminRole) {
    setEditing(role);
    setForm({
      code: role.code,
      name: role.name,
      status: role.status,
      permissions: [...role.permissions],
    });
    setEditorPermissionSearch('');
    setMode('edit');
  }

  function closeEditor() {
    if (saveRole.isPending) return;
    setMode(null);
    setEditing(null);
  }

  function togglePermission(permissionId: string) {
    if (editing?.code === 'platform_admin' && protectedPlatformAdminPermissions.has(permissionId)) return;
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permissionId)
        ? current.permissions.filter((id) => id !== permissionId)
        : [...current.permissions, permissionId],
    }));
  }

  function toggleModule(modulePermissions: string[]) {
    const mutable = modulePermissions.filter((id) =>
      !(editing?.code === 'platform_admin' && protectedPlatformAdminPermissions.has(id)));
    const allSelected = mutable.length > 0 && mutable.every((id) => form.permissions.includes(id));
    setForm((current) => ({
      ...current,
      permissions: allSelected
        ? current.permissions.filter((id) => !mutable.includes(id))
        : [...new Set([...current.permissions, ...mutable])],
    }));
  }

  const saveRole = useMutation({
    mutationFn: () => {
      if (!form.name.trim()) throw new Error('Enter a role name.');
      if (mode === 'create') {
        if (!form.code.trim()) throw new Error('Enter a role code.');
        return createAdminRole({
          code: form.code.trim(),
          name: form.name.trim(),
          status: form.status,
          permissions: form.permissions,
        });
      }
      if (!editing) throw new Error('Select a role.');
      return updateAdminRole(editing.id, editing.eTag, {
        name: form.name.trim(),
        status: form.status,
        permissions: form.permissions,
      });
    },
    onSuccess: async () => {
      setMode(null);
      setEditing(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'access-assignments'] }),
      ]);
    },
  });

  return (
    <INNOPage
      eyebrow="Admin Center · Access"
      title="Roles & Permissions"
      description="Create reusable roles and assign the permissions each role grants before binding it to users and scopes."
      actions={canManage ? <INNOButton type="button" onClick={openCreate}>New Role</INNOButton> : undefined}
    >
      <INNOCollection className="admin-role-catalog">
        <INNOCollectionHeader
          title="Roles"
          description="Role definitions used by access assignments."
          meta={roles.data ? <INNOStatus>{roles.data.length} roles</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search roles" value={search} onChange={setSearch} placeholder="Search role or code…" />
        </INNOCollectionToolbar>
        {roles.isPending ? <CollectionLoadingState label="Loading roles…" /> : null}
        {roles.isError ? <CollectionErrorState error={roles.error} retry={() => void roles.refetch()} /> : null}
        {filteredRoles.length ? (
          <INNOTableWrap>
            <table>
              <thead><tr><th>Role</th><th>Code</th><th className="numeric-column">Permissions</th><th>Status</th><th className="action-column">Action</th></tr></thead>
              <tbody>{filteredRoles.map((role) => (
                <tr key={role.id}>
                  <td><b>{role.name}</b>{role.code === 'platform_admin' ? <div className="table-meta">Protected platform role</div> : null}</td>
                  <td><code>{role.code}</code></td>
                  <td className="numeric-column">{role.permissions.length}</td>
                  <td><INNOStatus tone={role.status === 'active' ? 'success' : 'neutral'}>{role.status}</INNOStatus></td>
                  <td className="action-column">
                    {canManage
                      ? <INNORowActions ariaLabel={'Role ' + role.name} items={[{ id: 'edit', label: 'Edit Role', onSelect: () => openEdit(role) }]} />
                      : <span className="table-meta">View only</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </INNOTableWrap>
        ) : roles.data ? (
          <INNOCollectionState
            kind={search ? 'no-results' : 'empty'}
            title={search ? 'No roles found' : 'No roles yet'}
            description={search ? 'Try another search.' : 'Create the first reusable role.'}
            action={search ? <INNOButton variant="secondary" onClick={() => setSearch('')}>Clear search</INNOButton> : undefined}
          />
        ) : null}
      </INNOCollection>

      <INNOCollection className="admin-permission-collection">
        <INNOCollectionHeader
          title="Permission matrix"
          description="Reference view of effective permissions granted by each saved role."
          meta={permissions.data ? <INNOStatus>{permissions.data.length} permissions</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search permissions" value={permissionSearch} onChange={setPermissionSearch} placeholder="Search permission, module or description…" />
        </INNOCollectionToolbar>
        {permissions.isPending ? <CollectionLoadingState label="Loading permissions…" /> : null}
        {permissions.isError ? <CollectionErrorState error={permissions.error} retry={() => void permissions.refetch()} /> : null}
        {permissions.data && filteredPermissions.length === 0 ? (
          <INNOCollectionState
            kind={permissionSearch ? 'no-results' : 'empty'}
            title={permissionSearch ? 'No permissions found' : 'No permissions available'}
            description={permissionSearch ? 'Try another search.' : 'The permission catalog is empty.'}
            action={permissionSearch ? <INNOButton variant="secondary" onClick={() => setPermissionSearch('')}>Clear search</INNOButton> : undefined}
          />
        ) : null}
        {filteredPermissions.length ? (
          <INNOTableWrap width="xwide">
            <table className="admin-permission-matrix">
              <thead>
                <tr><th>Permission</th><th>Module</th>{roles.data?.map((role) => <th key={role.id}>{role.name}</th>)}</tr>
              </thead>
              <tbody>{filteredPermissions.map((permission) => (
                <tr key={permission.id}>
                  <td><b>{permission.id}</b><div className="table-meta">{permission.name}</div></td>
                  <td>{permission.module}</td>
                  {roles.data?.map((role) => <td key={role.id} className="admin-permission-cell">{role.permissions.includes(permission.id) ? <INNOIcon token="status.success" size={14} /> : '—'}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </INNOTableWrap>
        ) : null}
      </INNOCollection>

      <INNODrawer
        open={mode !== null}
        title={mode === 'create' ? 'New Role' : 'Edit Role'}
        description={mode === 'create'
          ? 'Define a reusable role and choose the permissions it grants.'
          : 'Update the role name, status and granted permissions.'}
        onClose={closeEditor}
        size="lg"
        className="admin-role-drawer"
        footer={<>
          <INNOButton type="button" variant="secondary" disabled={saveRole.isPending} onClick={closeEditor}>Cancel</INNOButton>
          <INNOButton
            type="submit"
            form="role-editor-form"
            busy={saveRole.isPending}
            disabled={!form.name.trim() || (mode === 'create' && !form.code.trim())}
          >
            {mode === 'create' ? 'Create Role' : 'Save Role'}
          </INNOButton>
        </>}
      >
        <form
          id="role-editor-form"
          className="admin-role-editor"
          onSubmit={(event) => { event.preventDefault(); if (!saveRole.isPending) saveRole.mutate(); }}
        >
          <div className="editor-grid">
            <label className="field-block">
              <span>Role code</span>
              <input
                data-autofocus
                required
                disabled={mode === 'edit'}
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                placeholder="e.g. asset_manager"
              />
              <small>{mode === 'edit' ? 'Role code is stable after creation.' : 'Use letters, numbers, dot, dash or underscore.'}</small>
            </label>
            <label className="field-block">
              <span>Role name</span>
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="field-block field-wide">
              <span>Status</span>
              <select
                value={form.status}
                disabled={editing?.code === 'platform_admin'}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <section className="admin-role-permissions">
            <div className="admin-role-permissions-head">
              <div>
                <h3>Assigned permissions</h3>
                <p>{form.permissions.length} permissions selected. Changes affect access assignments using this role.</p>
              </div>
              <INNOSearchField
                label="Search permissions to assign"
                value={editorPermissionSearch}
                onChange={setEditorPermissionSearch}
                placeholder="Search permission or module…"
              />
            </div>

            {permissions.isPending ? <LoadingState label="Loading permission catalog…" /> : null}
            {permissions.isError ? <ErrorState error={permissions.error} retry={() => void permissions.refetch()} /> : null}
            {editorGroups.map(([moduleName, modulePermissions]) => {
              const ids = modulePermissions.map((permission) => permission.id);
              const editableIds = ids.filter((id) => !(editing?.code === 'platform_admin' && protectedPlatformAdminPermissions.has(id)));
              const allSelected = editableIds.length > 0 && editableIds.every((id) => form.permissions.includes(id));
              return (
                <div className="admin-permission-group" key={moduleName}>
                  <div className="admin-permission-group-head">
                    <div><b>{moduleName}</b><span>{modulePermissions.length} permissions</span></div>
                    <INNOButton type="button" variant="secondary" onClick={() => toggleModule(ids)}>
                      {allSelected ? 'Clear module' : 'Select module'}
                    </INNOButton>
                  </div>
                  <div className="admin-permission-checklist">
                    {modulePermissions.map((permission) => {
                      const protectedPermission = editing?.code === 'platform_admin' && protectedPlatformAdminPermissions.has(permission.id);
                      return (
                        <label className="admin-permission-option" key={permission.id}>
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(permission.id)}
                            disabled={protectedPermission}
                            onChange={() => togglePermission(permission.id)}
                          />
                          <span><b>{permission.name}</b><small>{permission.id}{protectedPermission ? ' · required for Platform Admin' : ''}</small></span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
          {saveRole.isError ? (
            <div className="form-error" role="alert">
              {saveRole.error instanceof Error ? saveRole.error.message : 'Unable to save role.'}
            </div>
          ) : null}
        </form>
      </INNODrawer>
    </INNOPage>
  );
}
