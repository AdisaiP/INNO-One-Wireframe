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

const blankForm = { code: '', name: '', status: 'active' };

export function AdminPositionsPage() {
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
      if (!editing) throw new Error('Select a position.');
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
      eyebrow="Admin Center · Organization"
      title="Positions"
      description="Maintain canonical organization positions used by user profiles."
      actions={canManage ? <INNOButton type="button" onClick={openCreate}>New Position</INNOButton> : undefined}
    >
      <INNOCollection>
        <INNOCollectionHeader
          title="Positions"
          description="Reusable organization position master."
          meta={query.data ? <INNOStatus>{query.data.length} positions</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search positions" value={search} onChange={setSearch} placeholder="Search position or code…" />
        </INNOCollectionToolbar>
        {query.isPending ? <CollectionLoadingState label="Loading positions…" /> : null}
        {query.isError ? <CollectionErrorState error={query.error} retry={() => void query.refetch()} /> : null}
        {items.length ? (
          <INNOTableWrap stickyAction>
            <table>
              <thead><tr><th>Position</th><th>Code</th><th>Status</th><th className="action-column">Action</th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.name}</b></td>
                  <td>{item.code}</td>
                  <td><INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus></td>
                  <td className="action-column">
                    {canManage
                      ? <INNORowActions ariaLabel={'Position ' + item.name} items={[{ id: 'edit', label: 'Edit', onSelect: () => openEdit(item) }]} />
                      : <span className="table-meta">View only</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </INNOTableWrap>
        ) : query.data ? (
          <INNOCollectionState
            kind={search ? 'no-results' : 'empty'}
            title={search ? 'No positions found' : 'Nothing here yet'}
            description={search ? 'Try another search.' : 'Create the first position.'}
            action={search ? <INNOButton variant="secondary" onClick={() => setSearch('')}>Clear search</INNOButton> : undefined}
          />
        ) : null}
      </INNOCollection>

      <INNODialog
        open={dialogMode !== null}
        title={dialogMode === 'create' ? 'New Position' : 'Edit Position'}
        description={dialogMode === 'create' ? 'Create a reusable organization position.' : 'Update this organization position.'}
        onClose={closeDialog}
        size="sm"
        footer={<>
          <INNOButton type="button" variant="secondary" disabled={mutation.isPending} onClick={closeDialog}>Cancel</INNOButton>
          <INNOButton
            type="submit"
            form="position-dialog-form"
            busy={mutation.isPending}
            disabled={!form.code.trim() || !form.name.trim()}
          >
            {dialogMode === 'create' ? 'Create Position' : 'Save Position'}
          </INNOButton>
        </>}
      >
        <form
          id="position-dialog-form"
          className="editor-form"
          onSubmit={(event) => { event.preventDefault(); if (!mutation.isPending) mutation.mutate(); }}
        >
          <div className="editor-grid">
            <label className="field-block"><span>Code</span><input data-autofocus required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
            <label className="field-block"><span>Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field-block field-wide"><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          </div>
          {mutation.isError ? <ErrorState error={mutation.error} /> : null}
        </form>
      </INNODialog>
    </INNOPage>
  );
}
