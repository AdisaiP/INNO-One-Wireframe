import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { INNOIcon, INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar, INNOEditorFooter, INNOPage, INNOSearchField, INNOState, INNOStatus, INNOTableWrap } from '@inno/ui';
import { createAdminPosition, getAdminPositions, updateAdminPosition } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

export function AdminPositionsPage() {
  const canManage = usePermission('admin.positions.manage');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [createMode, setCreateMode] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', status: 'active' });
  const query = useQuery({ queryKey: ['admin', 'positions'], queryFn: getAdminPositions });
  const selected = query.data?.find((item) => item.id === selectedId) ?? null;
  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? []).filter((item) => !term || item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term));
  }, [query.data, search]);

  useEffect(() => {
    if (selected) setForm({ code: selected.code, name: selected.name, status: selected.status });
  }, [selected]);

  const mutation = useMutation({
    mutationFn: () => {
      const input = { code: form.code.trim(), name: form.name.trim(), status: form.status };
      if (createMode) return createAdminPosition(input);
      if (!selected) throw new Error('Select a position.');
      return updateAdminPosition(selected.id, selected.eTag, input);
    },
    onSuccess: async (saved) => {
      setCreateMode(false);
      setSelectedId(saved.id);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'positions'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });

  return (
    <INNOPage
      eyebrow="Admin Center · Organization"
      title="Positions"
      description="Maintain canonical organization positions used by user profiles."
      actions={canManage ? <INNOButton type="button" onClick={() => { setCreateMode(true); setSelectedId(''); setForm({ code: '', name: '', status: 'active' }); }}>New Position</INNOButton> : undefined}
    >
      <div className="admin-master-detail">
        <INNOCollection>
          <INNOCollectionHeader title="Positions" description="Reusable organization position master." meta={query.data ? <INNOStatus>{query.data.length} positions</INNOStatus> : undefined} />
          <INNOCollectionToolbar><INNOSearchField label="Search positions" value={search} onChange={setSearch} placeholder="Search position or code…" /></INNOCollectionToolbar>
          {query.isPending ? <div className="collection-state"><LoadingState label="Loading positions…" /></div> : null}
          {query.isError ? <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div> : null}
          {items.length ? (
            <INNOTableWrap>
              <table><thead><tr><th>Position</th><th>Code</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>{items.map((item) => <tr key={item.id} className={item.id === selectedId ? 'selected-row' : undefined}><td><b>{item.name}</b></td><td>{item.code}</td><td><INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus></td><td className="action-column"><button type="button" className="device-row-action" aria-label={'Open ' + item.name} onClick={() => { setCreateMode(false); setSelectedId(item.id); }}><INNOIcon token="action.next" size={14} /></button></td></tr>)}</tbody>
              </table>
            </INNOTableWrap>
          ) : query.data ? <div className="collection-state"><INNOState kind={search ? 'no-results' : 'empty'} title="No positions found" description={search ? 'Try another search.' : 'Create the first position.'} /></div> : null}
        </INNOCollection>
        <section className="prod-panel admin-editor-panel">
          <div className="prod-panel-head"><div><h3>{createMode ? 'New Position' : selected?.name ?? 'Position details'}</h3><p>{createMode ? 'Create a reusable organization position.' : selected ? 'Edit this position.' : 'Select a row to inspect or edit.'}</p></div></div>
          {createMode || selected ? (
            <form className="editor-form" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
              <div className="editor-grid">
                <label className="field-block"><span>Code</span><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
                <label className="field-block"><span>Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="field-block"><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
              </div>
              {mutation.isError ? <ErrorState error={mutation.error} /> : null}
              <INNOEditorFooter>
                {createMode ? <INNOButton type="button" variant="secondary" onClick={() => setCreateMode(false)}>Cancel</INNOButton> : null}
                <INNOButton type="submit" busy={mutation.isPending} disabled={!canManage || !form.code.trim() || !form.name.trim()}>Save</INNOButton>
              </INNOEditorFooter>
            </form>
          ) : <div className="collection-state"><INNOState title="Select a position" description="Choose a row to edit it." /></div>}
        </section>
      </div>
    </INNOPage>
  );
}
