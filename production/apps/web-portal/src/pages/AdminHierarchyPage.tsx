import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  INNOIcon,
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOCollectionToolbar,
  INNOEditorFooter, INNOEditorFooterEnd, INNOEditorFooterStart,
  INNOPage,
  INNOSearchField,
  INNOSelectField,
  INNOState,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import {
  createAdminLocation,
  createAdminOrganizationUnit,
  getAdminLocations,
  getAdminOrganizationTree,
  updateAdminLocation,
  updateAdminOrganizationUnit,
} from '../api/client';
import type { AdminHierarchyItem } from '../api/types';
import { CollectionErrorState, CollectionLoadingState, ErrorState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

type Kind = 'organization' | 'location';

export function AdminHierarchyPage({ kind }: { kind: Kind }) {
  const isOrganization = kind === 'organization';
  const canManage = usePermission(isOrganization ? 'admin.organization.manage' : 'admin.locations.manage');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [createMode, setCreateMode] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', parentId: '', status: 'active' });
  const title = isOrganization ? 'Organization Structure' : 'Locations';
  const queryKey = ['admin', kind];
  const query = useQuery({
    queryKey,
    queryFn: isOrganization ? getAdminOrganizationTree : getAdminLocations,
  });

  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? []).filter((item) =>
      !term || item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term),
    );
  }, [query.data, search]);

  const selected = (query.data ?? []).find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setCreateMode(false);
    setForm({
      code: selected.code,
      name: selected.name,
      parentId: selected.parentId ?? '',
      status: selected.status,
    });
  }, [selected]);

  const mutation = useMutation({
    mutationFn: async () => {
      const input = {
        code: form.code.trim(),
        name: form.name.trim(),
        parentId: form.parentId || null,
        status: form.status,
      };
      if (createMode) {
        return isOrganization
          ? createAdminOrganizationUnit(input)
          : createAdminLocation(input);
      }
      if (!selected) throw new Error('Select a record.');
      return isOrganization
        ? updateAdminOrganizationUnit(selected.id, selected.eTag, input)
        : updateAdminLocation(selected.id, selected.eTag, input);
    },
    onSuccess: async (saved) => {
      setSelectedId(saved.id);
      setCreateMode(false);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });

  function beginCreate() {
    setSelectedId('');
    setCreateMode(true);
    setForm({ code: '', name: '', parentId: '', status: 'active' });
  }

  const parentOptions = (query.data ?? []).filter((item) => item.id !== selected?.id);

  return (
    <INNOPage
      eyebrow="Admin Center · Organization"
      title={title}
      description={isOrganization
        ? 'Maintain the canonical organization hierarchy used by access scopes and resource ownership.'
        : 'Maintain the reusable location hierarchy used by users, devices, assets, and access scopes.'}
      actions={canManage ? (
        <INNOButton type="button" onClick={beginCreate}>New {isOrganization ? 'Unit' : 'Location'}</INNOButton>
      ) : undefined}
    >
      <div className="admin-master-detail">
        <INNOCollection>
          <INNOCollectionHeader title={title} description="Select a record to inspect or edit." meta={query.data ? <INNOStatus>{query.data.length} records</INNOStatus> : undefined} />
          <INNOCollectionToolbar>
            <INNOSearchField label={'Search ' + title.toLowerCase()} value={search} onChange={setSearch} placeholder="Search name or code…" />
          </INNOCollectionToolbar>
          {query.isPending ? <CollectionLoadingState label={'Loading ' + title.toLowerCase() + '…'} /> : null}
          {query.isError ? <CollectionErrorState error={query.error} retry={() => void query.refetch()} /> : null}
          {query.data && items.length === 0 ? (
            <INNOCollectionState
              kind={search ? 'no-results' : 'empty'}
              title={search ? 'No records found' : 'Nothing here yet'}
              description={search ? 'Try another search.' : 'Create the first record when you are ready.'}
              action={search ? <INNOButton variant="secondary" onClick={() => setSearch('')}>Clear search</INNOButton> : undefined}
            />
          ) : null}
          {items.length > 0 ? (
            <INNOTableWrap stickyAction>
              <table>
                <thead><tr><th>Name</th><th>Code</th><th>Parent</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>
                  {items.map((item) => {
                    const parent = query.data?.find((candidate) => candidate.id === item.parentId);
                    return (
                      <tr key={item.id} className={item.id === selectedId ? 'selected-row' : undefined}>
                        <td><b>{item.name}</b></td>
                        <td>{item.code}</td>
                        <td>{parent?.name ?? '—'}</td>
                        <td><INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus></td>
                        <td className="action-column"><button type="button" className="inno-row-action" aria-label={'Select ' + item.name} onClick={() => setSelectedId(item.id)}>Select</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </INNOTableWrap>
          ) : null}
        </INNOCollection>

        <section className="prod-panel admin-editor-panel">
          <div className="prod-panel-head">
            <div>
              <h3>{createMode ? 'New ' + (isOrganization ? 'Organization Unit' : 'Location') : selected ? selected.name : 'Record details'}</h3>
              <p>{createMode ? 'Create a canonical administration master.' : selected ? 'Edit this record with optimistic concurrency.' : 'Select a row or create a new record.'}</p>
            </div>
          </div>
          {createMode || selected ? (
            <form className="editor-form" onSubmit={(event) => { event.preventDefault(); if (!mutation.isPending) mutation.mutate(); }}>
              <div className="editor-grid">
                <label className="field-block"><span>Code</span><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
                <label className="field-block"><span>Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="field-block">
                  <span>Parent</span>
                  <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                    <option value="">No parent</option>
                    {parentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="field-block">
                  <span>Status</span>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>
              {mutation.isError ? <ErrorState error={mutation.error} /> : null}
              <INNOEditorFooter>
                <INNOEditorFooterStart>
                  {createMode ? <INNOButton type="button" variant="secondary" onClick={() => setCreateMode(false)}>Cancel</INNOButton> : null}
                </INNOEditorFooterStart>
                <INNOEditorFooterEnd>
                  <INNOButton type="submit" busy={mutation.isPending} disabled={!canManage || !form.code.trim() || !form.name.trim()}>Save</INNOButton>
                </INNOEditorFooterEnd>
              </INNOEditorFooter>
            </form>
          ) : (
            <div className="collection-state"><INNOState title="Select a record" description="Choose a row to inspect its hierarchy and edit it." /></div>
          )}
        </section>
      </div>
    </INNOPage>
  );
}

export function AdminOrganizationPage() {
  return <AdminHierarchyPage kind="organization" />;
}

export function AdminLocationsPage() {
  return <AdminHierarchyPage kind="location" />;
}
