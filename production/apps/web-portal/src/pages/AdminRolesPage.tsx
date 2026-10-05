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
import { useI18n as useStep45NI18n } from '@inno/i18n';

const blankForm = { code: '', name: '', status: 'active', permissions: [] as string[] };
const protectedPlatformAdminPermissions = new Set(['admin.access', 'admin.roles.view', 'admin.roles.manage']);

export function AdminRolesPage() {
  const { t: t45n } = useStep45NI18n();
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
      if (!form.name.trim()) throw new Error(t45n('admin.step45n.adminRoles.enterARoleName'));
      if (mode === 'create') {
        if (!form.code.trim()) throw new Error(t45n('admin.step45n.adminRoles.enterARoleCode'));
        return createAdminRole({
          code: form.code.trim(),
          name: form.name.trim(),
          status: form.status,
          permissions: form.permissions,
        });
      }
      if (!editing) throw new Error(t45n('admin.step45n.adminRoles.selectARole'));
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
      eyebrow={t45n('admin.step45n.adminAccessScopeEdit.adminCenterAccess')}
      title={t45n('navigation.rolesPermissions')}
      description={t45n('admin.step45n.adminRoles.createReusableRolesAndAssignThePermissionsEach')}
      actions={canManage ? <INNOButton type="button" onClick={openCreate}>{t45n('admin.step45n.adminRoles.newRole')}</INNOButton> : undefined}
    >
      <INNOCollection className="admin-role-catalog">
        <INNOCollectionHeader
          title={t45n('admin.step45n.adminRoles.roles')}
          description={t45n('admin.step45n.adminRoles.roleDefinitionsUsedByAccessAssignments')}
          meta={roles.data ? <INNOStatus>{roles.data.length} {t45n('admin.step45n.adminRoles.roles2')}</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label={t45n('admin.step45n.adminRoles.searchRoles')} value={search} onChange={setSearch} placeholder={t45n('admin.step45n.adminRoles.searchRoleOrCode')} />
        </INNOCollectionToolbar>
        {roles.isPending ? <CollectionLoadingState label={t45n('admin.step45n.adminRoles.loadingRoles')} /> : null}
        {roles.isError ? <CollectionErrorState error={roles.error} retry={() => void roles.refetch()} /> : null}
        {filteredRoles.length ? (
          <INNOTableWrap>
            <table>
              <thead><tr><th>{t45n('admin.step45n.adminAccessScopeEdit.role')}</th><th>{t45n('admin.step45n.adminHierarchy.code')}</th><th className="numeric-column">{t45n('admin.step45n.adminRoles.permissions')}</th><th>{t45n('reports.runs.status')}</th><th className="action-column">{t45n('reports.table.action')}</th></tr></thead>
              <tbody>{filteredRoles.map((role) => (
                <tr key={role.id}>
                  <td><b>{role.name}</b>{role.code === 'platform_admin' ? <div className="table-meta">{t45n('admin.step45n.adminRoles.protectedPlatformRole')}</div> : null}</td>
                  <td><code>{role.code}</code></td>
                  <td className="numeric-column">{role.permissions.length}</td>
                  <td><INNOStatus tone={role.status === 'active' ? 'success' : 'neutral'}>{role.status}</INNOStatus></td>
                  <td className="action-column">
                    {canManage
                      ? <INNORowActions ariaLabel={t45n('admin.step45n.adminAccessScopeEdit.role') + ' ' + role.name} items={[{ id: 'edit', label: t45n('admin.step45n.adminRoles.editRole'), onSelect: () => openEdit(role) }]} />
                      : <span className="table-meta">{t45n('admin.step45n.adminAccessScopes.viewOnly')}</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </INNOTableWrap>
        ) : roles.data ? (
          <INNOCollectionState
            kind={search ? 'no-results' : 'empty'}
            title={search ? t45n('admin.step45n.adminRoles.noRolesFound') : t45n('admin.step45n.adminRoles.noRolesYet')}
            description={search ? t45n('reports.noResults.description') : t45n('admin.step45n.adminRoles.createTheFirstReusableRole')}
            action={search ? <INNOButton variant="secondary" onClick={() => setSearch('')}>{t45n('assets.automation.clearSearch')}</INNOButton> : undefined}
          />
        ) : null}
      </INNOCollection>

      <INNOCollection className="admin-permission-collection">
        <INNOCollectionHeader
          title={t45n('admin.step45n.adminRoles.permissionMatrix')}
          description={t45n('admin.step45n.adminRoles.referenceViewOfEffectivePermissionsGrantedByEach')}
          meta={permissions.data ? <INNOStatus>{permissions.data.length} {t45n('admin.step45n.adminRoles.permissions2')}</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label={t45n('admin.step45n.adminRoles.searchPermissions')} value={permissionSearch} onChange={setPermissionSearch} placeholder={t45n('admin.step45n.adminRoles.searchPermissionModuleOrDescription')} />
        </INNOCollectionToolbar>
        {permissions.isPending ? <CollectionLoadingState label={t45n('admin.step45n.adminRoles.loadingPermissions')} /> : null}
        {permissions.isError ? <CollectionErrorState error={permissions.error} retry={() => void permissions.refetch()} /> : null}
        {permissions.data && filteredPermissions.length === 0 ? (
          <INNOCollectionState
            kind={permissionSearch ? 'no-results' : 'empty'}
            title={permissionSearch ? t45n('admin.step45n.adminRoles.noPermissionsFound') : t45n('admin.step45n.adminRoles.noPermissionsAvailable')}
            description={permissionSearch ? t45n('reports.noResults.description') : t45n('admin.step45n.adminRoles.thePermissionCatalogIsEmpty')}
            action={permissionSearch ? <INNOButton variant="secondary" onClick={() => setPermissionSearch('')}>{t45n('assets.automation.clearSearch')}</INNOButton> : undefined}
          />
        ) : null}
        {filteredPermissions.length ? (
          <INNOTableWrap width="xwide">
            <table className="admin-permission-matrix">
              <thead>
                <tr><th>{t45n('admin.step45n.adminAccessScopes.permission')}</th><th>{t45n('admin.step45n.adminApps.module')}</th>{roles.data?.map((role) => <th key={role.id}>{role.name}</th>)}</tr>
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
        title={mode === 'create' ? t45n('admin.step45n.adminRoles.newRole') : t45n('admin.step45n.adminRoles.editRole')}
        description={mode === 'create'
          ? t45n('admin.step45n.adminRoles.defineAReusableRoleAndChooseThePermissions')
          : t45n('admin.step45n.adminRoles.updateTheRoleNameStatusAndGrantedPermissions')}
        onClose={closeEditor}
        size="lg"
        className="admin-role-drawer"
        footer={<>
          <INNOButton type="button" variant="secondary" disabled={saveRole.isPending} onClick={closeEditor}>{t45n('reports.action.cancel')}</INNOButton>
          <INNOButton
            type="submit"
            form="role-editor-form"
            busy={saveRole.isPending}
            disabled={!form.name.trim() || (mode === 'create' && !form.code.trim())}
          >
            {mode === 'create' ? t45n('admin.step45n.adminRoles.createRole') : t45n('admin.step45n.adminRoles.saveRole')}
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
              <span>{t45n('admin.step45n.adminRoles.roleCode')}</span>
              <input
                data-autofocus
                required
                disabled={mode === 'edit'}
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                placeholder={t45n('admin.step45n.adminRoles.eGAssetManager')}
              />
              <small>{mode === 'edit' ? t45n('admin.step45n.adminRoles.roleCodeIsStableAfterCreation') : t45n('admin.step45n.adminRoles.useLettersNumbersDotDashOrUnderscore')}</small>
            </label>
            <label className="field-block">
              <span>{t45n('admin.step45n.adminRoles.roleName')}</span>
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="field-block field-wide">
              <span>{t45n('reports.runs.status')}</span>
              <select
                value={form.status}
                disabled={editing?.code === 'platform_admin'}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                <option value="active">{t45n('reports.status.active')}</option>
                <option value="inactive">{t45n('admin.step45n.adminAccessScopeEdit.inactive')}</option>
              </select>
            </label>
          </div>

          <section className="admin-role-permissions">
            <div className="admin-role-permissions-head">
              <div>
                <h3>{t45n('admin.step45n.adminRoles.assignedPermissions')}</h3>
                <p>{form.permissions.length} {t45n('admin.step45n.adminRoles.permissionsSelectedChangesAffectAccessAssignmentsUsingThis')}</p>
              </div>
              <INNOSearchField
                label={t45n('admin.step45n.adminRoles.searchPermissionsToAssign')}
                value={editorPermissionSearch}
                onChange={setEditorPermissionSearch}
                placeholder={t45n('admin.step45n.adminRoles.searchPermissionOrModule')}
              />
            </div>

            {permissions.isPending ? <LoadingState label={t45n('admin.step45n.adminRoles.loadingPermissionCatalog')} /> : null}
            {permissions.isError ? <ErrorState error={permissions.error} retry={() => void permissions.refetch()} /> : null}
            {editorGroups.map(([moduleName, modulePermissions]) => {
              const ids = modulePermissions.map((permission) => permission.id);
              const editableIds = ids.filter((id) => !(editing?.code === 'platform_admin' && protectedPlatformAdminPermissions.has(id)));
              const allSelected = editableIds.length > 0 && editableIds.every((id) => form.permissions.includes(id));
              return (
                <div className="admin-permission-group" key={moduleName}>
                  <div className="admin-permission-group-head">
                    <div><b>{moduleName}</b><span>{modulePermissions.length} {t45n('admin.step45n.adminRoles.permissions2')}</span></div>
                    <INNOButton type="button" variant="secondary" onClick={() => toggleModule(ids)}>
                      {allSelected ? t45n('admin.step45n.adminRoles.clearModule') : t45n('admin.step45n.adminRoles.selectModule')}
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
                          <span><b>{permission.name}</b><small>{permission.id}{protectedPermission ? t45n('admin.step45n.adminRoles.requiredForPlatformAdmin') : ''}</small></span>
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
              {saveRole.error instanceof Error ? saveRole.error.message : t45n('admin.step45n.adminRoles.unableToSaveRole')}
            </div>
          ) : null}
        </form>
      </INNODrawer>
    </INNOPage>
  );
}
