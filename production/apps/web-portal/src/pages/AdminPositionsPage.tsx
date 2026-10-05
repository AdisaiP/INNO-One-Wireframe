import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState,
  INNOCollectionToolbar, INNODialog, INNOPage, INNORowActions, INNOSearchField,
  INNOStatus, INNOTableWrap,
} from '@inno/ui';
import { createAdminPosition, getAdminPositions, updateAdminPosition } from '../api/client';
import type { AdminPosition } from '../api/types';
import { CollectionErrorState, CollectionLoadingState, ErrorState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

const blankForm = { code: '', name: '', status: 'active' };

export function AdminPositionsPage() {
  const { t: t45n } = useStep45NI18n();
  const canManage = usePermission('admin.positions.manage');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<AdminPosition | null>(null);
  const [form, setForm] = useState(blankForm);
  const query = useQuery({ queryKey: ['admin', 'positions'], queryFn: getAdminPositions });
  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? []).filter((item) =>
      !term || item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term));
  }, [query.data, search]);

  function openCreate() {
    setEditing(null);
    setForm(blankForm);
    setDialogMode('create');
  }

  function openEdit(item: AdminPosition) {
    setEditing(item);
    setForm({ code: item.code, name: item.name, status: item.status });
    setDialogMode('edit');
  }

  function closeDialog() {
    if (mutation.isPending) return;
    setDialogMode(null);
    setEditing(null);
  }

  const mutation = useMutation({
    mutationFn: () => {
      const input = { code: form.code.trim(), name: form.name.trim(), status: form.status };
      if (dialogMode === 'create') return createAdminPosition(input);
      if (!editing) throw new Error(t45n('admin.step45n.adminPositions.selectAPosition'));
      return updateAdminPosition(editing.id, editing.eTag, input);
    },
    onSuccess: async () => {
      setDialogMode(null);
      setEditing(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'positions'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
      ]);
    },
  });

  return (
    <INNOPage
      eyebrow={t45n('admin.step45n.adminHierarchy.adminCenterOrganization')}
      title={t45n('navigation.positions')}
      description={t45n('admin.step45n.adminPositions.maintainCanonicalOrganizationPositionsUsedByUserProfiles')}
      actions={canManage ? <INNOButton type="button" onClick={openCreate}>{t45n('admin.step45n.adminPositions.newPosition')}</INNOButton> : undefined}
    >
      <INNOCollection>
        <INNOCollectionHeader
          title={t45n('navigation.positions')}
          description={t45n('admin.step45n.adminPositions.reusableOrganizationPositionMaster')}
          meta={query.data ? <INNOStatus>{query.data.length} {t45n('admin.step45n.adminPositions.positions')}</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label={t45n('admin.step45n.adminPositions.searchPositions')} value={search} onChange={setSearch} placeholder={t45n('admin.step45n.adminPositions.searchPositionOrCode')} />
        </INNOCollectionToolbar>
        {query.isPending ? <CollectionLoadingState label={t45n('admin.step45n.adminPositions.loadingPositions')} /> : null}
        {query.isError ? <CollectionErrorState error={query.error} retry={() => void query.refetch()} /> : null}
        {items.length ? (
          <INNOTableWrap stickyAction>
            <table>
              <thead><tr><th>{t45n('admin.step45n.adminPositions.position')}</th><th>{t45n('admin.step45n.adminHierarchy.code')}</th><th>{t45n('reports.runs.status')}</th><th className="action-column">{t45n('reports.table.action')}</th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.name}</b></td>
                  <td>{item.code}</td>
                  <td><INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus></td>
                  <td className="action-column">
                    {canManage
                      ? <INNORowActions ariaLabel={t45n('admin.step45n.adminPositions.position') + ' ' + item.name} items={[{ id: 'edit', label: t45n('reports.action.edit'), onSelect: () => openEdit(item) }]} />
                      : <span className="table-meta">{t45n('admin.step45n.adminAccessScopes.viewOnly')}</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </INNOTableWrap>
        ) : query.data ? (
          <INNOCollectionState
            kind={search ? 'no-results' : 'empty'}
            title={search ? t45n('admin.step45n.adminPositions.noPositionsFound') : t45n('admin.step45n.adminHierarchy.nothingHereYet')}
            description={search ? t45n('reports.noResults.description') : t45n('admin.step45n.adminPositions.createTheFirstPosition')}
            action={search ? <INNOButton variant="secondary" onClick={() => setSearch('')}>{t45n('assets.automation.clearSearch')}</INNOButton> : undefined}
          />
        ) : null}
      </INNOCollection>

      <INNODialog
        open={dialogMode !== null}
        title={dialogMode === 'create' ? t45n('admin.step45n.adminPositions.newPosition') : t45n('admin.step45n.adminPositions.editPosition')}
        description={dialogMode === 'create' ? t45n('admin.step45n.adminPositions.createAReusableOrganizationPosition') : t45n('admin.step45n.adminPositions.updateThisOrganizationPosition')}
        onClose={closeDialog}
        size="sm"
        footer={<>
          <INNOButton type="button" variant="secondary" disabled={mutation.isPending} onClick={closeDialog}>{t45n('reports.action.cancel')}</INNOButton>
          <INNOButton
            type="submit"
            form="position-dialog-form"
            busy={mutation.isPending}
            disabled={!form.code.trim() || !form.name.trim()}
          >
            {dialogMode === 'create' ? t45n('admin.step45n.adminPositions.createPosition') : t45n('admin.step45n.adminPositions.savePosition')}
          </INNOButton>
        </>}
      >
        <form
          id="position-dialog-form"
          className="editor-form"
          onSubmit={(event) => { event.preventDefault(); if (!mutation.isPending) mutation.mutate(); }}
        >
          <div className="editor-grid">
            <label className="field-block"><span>{t45n('admin.step45n.adminHierarchy.code')}</span><input data-autofocus required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
            <label className="field-block"><span>{t45n('admin.step45n.adminHierarchy.name')}</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field-block field-wide"><span>{t45n('reports.runs.status')}</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">{t45n('reports.status.active')}</option><option value="inactive">{t45n('admin.step45n.adminAccessScopeEdit.inactive')}</option></select></label>
          </div>
          {mutation.isError ? <ErrorState error={mutation.error} /> : null}
        </form>
      </INNODialog>
    </INNOPage>
  );
}
